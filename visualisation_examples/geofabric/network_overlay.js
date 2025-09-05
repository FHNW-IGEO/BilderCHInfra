(function() {
  const DATA_URL = 'kraftwerke.json';
  const OVERLAY_ID = 'network-overlay-svg';
  const MAP_CENTER = [8.3, 46.8];
  const MAP_SCALE = 6000; // slightly smaller scale to shrink map
  const RADIUS_RATIO = 0.18; // smaller base ratio so everything fits
  const DOT_OUT_OFFSET = 6;
  const LANE_SPACING = 6;
  const LINK_COLOR = '#cdcecfff';
  const RING_COLOR = '#b6b7b8ff';

  function parseCoords(coordStr) {
    if (typeof coordStr === 'string' && coordStr.includes(',')) {
      const parts = coordStr.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !parts.some(isNaN)) return [parts[1], parts[0]];
    }
    return null;
  }

  function createOverlaySVG(container) {
    const prev = container.querySelector('#' + OVERLAY_ID);
    if (prev) prev.remove();
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const svg = d3.select(container)
      .append('svg')
      .attr('id', OVERLAY_ID)
      .attr('width', rect.width)
      .attr('height', rect.height)
      .style('position', 'absolute')
      .style('inset', 0)
      .style('pointer-events', 'none');
    return {
      svg,
      width: rect.width,
      height: rect.height
    };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    // normalize both angles into [0, 2π)
    let a0 = (startAngle + 2 * Math.PI) % (2 * Math.PI);
    let a1 = (endAngle + 2 * Math.PI) % (2 * Math.PI);
    // compute angular difference
    let delta = a1 - a0;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    // new end angle is start + shortest delta
    a1 = a0 + delta;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
    const sweep = delta >= 0 ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${largeArc} ${sweep} ${x1},${y1}`;
  }
  async function draw(container) {
    const overlay = createOverlaySVG(container);
    if (!overlay) return;
    const {
      svg,
      width,
      height
    } = overlay;
    const cx = width / 2,
      cy = height / 2;
    const baseRadius = Math.min(width, height) * RADIUS_RATIO;
    const projection = d3.geoMercator()
      .center(MAP_CENTER)
      .scale(MAP_SCALE)
      .translate([cx, cy]);
    let sampleData;
    try {
      const resp = await fetch(DATA_URL);
      sampleData = await resp.json();
    } catch (e) {
      console.error('Failed to load data', e);
      return;
    }
    const nodesRaw = sampleData.nodes || [];
    // Separate nodes with and without coordinates
    const innerNodes = nodesRaw
      .filter(n => n.group !== 'thema')
      .map(n => {
        const c = parseCoords(n.koordinaten);
        const proj = c ? projection(c) : null;
        return {
          ...n,
          proj
        };
      })
      .filter(n => n.proj);
    // Nodes with no coordinates should be placed on additional circular lanes
    const outerNodes = innerNodes.map((n, i) => {
      const dx = n.proj[0] - cx;
      const dy = n.proj[1] - cy;
      const angle = Math.atan2(dy, dx);
      const r = baseRadius + DOT_OUT_OFFSET + i * LANE_SPACING;
      return {
        id: n.id,
        name: n.name,
        group: n.group,
        angle,
        inner: n,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      };
    });
    // Assign further circular lanes to nodes without coordinates
    const outerNoCoordsNodes = nodesRaw
      .filter(n => n.koordinaten === null)
      .map((n, i) => {
        const r = baseRadius + DOT_OUT_OFFSET + (innerNodes.length + i) * LANE_SPACING;
        const angle = (i * Math.PI * 2) / nodesRaw.length; // Distribute these nodes evenly
        return {
          id: n.id,
          name: n.name,
          group: n.group,
          angle,
          inner: n,
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle)
        };
      });
    // Combine nodes with and without coordinates
    const allOuterNodes = outerNodes.concat(outerNoCoordsNodes);
    // ===== ORIENTATION CIRCLE =====
    svg.append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2)
      .attr('fill', 'none')
      .attr('stroke', RING_COLOR)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.1)
      .style('pointer-events', 'none');

    // ===== CONNECTORS =====
    const gLinks = svg.append('g').attr('class', 'ring-links');
    const connectors = gLinks.selectAll('line')
      .data(allOuterNodes)
      .enter()
      .append('line')
      .attr('class', d => `connector connector-${d.id}`)
      .attr('x1', d => d.x)
      .attr('y1', d => d.y)
      .attr('x2', d => d.inner.proj ? d.inner.proj[0] : d.x) // fallback for no coordinates
      .attr('y2', d => d.inner.proj ? d.inner.proj[1] : d.y) // fallback for no coordinates
      .attr('stroke', LINK_COLOR)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.7)
      .style('pointer-events', 'auto');
    connectors.lower();
    // ===== OUTER RELATIONSHIPS (INNER LANE ARCS) =====
    const outerLinks = (sampleData.links || [])
      .map(l => {
        const source = allOuterNodes.find(n => n.id === l.source);
        const target = allOuterNodes.find(n => n.id === l.target);
        if (!source || !target) return null;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const angle = Math.atan2(dy, dx);
        const rSource = Math.sqrt(Math.pow(source.x - cx, 2) + Math.pow(source.y - cy, 2));
        const rTarget = Math.sqrt(Math.pow(target.x - cx, 2) + Math.pow(target.y - cy, 2));
        return {
          source,
          target,
          rSource,
          rTarget,
          angle
        };
      })
      .filter(d => d);
    const gOuterLinks = svg.append('g').attr('class', 'outer-links');
    const arcGroups = gOuterLinks.selectAll('g.arc-group')
      .data(outerLinks)
      .enter()
      .append('g')
      .attr('class', d => `arc-group arc-${d.source.id} arc-${d.target.id}`);
    // Arcs
    arcGroups.append('path')
      .attr('class', 'arc-path')
      .attr('d', d => {
        const startAngle = d.source.angle;
        const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
        const laneRadius = Math.min(d.rSource, d.rTarget) - LANE_SPACING;
        return arcPath(cx, cy, laneRadius, startAngle, endAngle);
      })
      .attr('stroke', '#888')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .style('pointer-events', 'auto');
    // ===== CONNECTION LINES FOR NODES WITHOUT COORDINATES =====
    const gNoCoordLinks = svg.append('g').attr('class', 'no-coord-links');
    const noCoordLinks = gNoCoordLinks.selectAll('line')
      .data(outerNoCoordsNodes)
      .enter()
      .append('line')
      .attr('class', d => `nocoordconnector nocoordconnector-${d.id}`)
      .attr('x1', d => d.x)
      .attr('y1', d => d.y)
      .attr('x2', d => {
        const angle = Math.atan2(d.y - cy, d.x - cx);
        const r = baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2;
        return cx + r * Math.cos(angle);
      })
      .attr('y2', d => {
        const angle = Math.atan2(d.y - cy, d.x - cx);
        const r = baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2;
        return cy + r * Math.sin(angle);
      })
      .attr('stroke', '#888')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 2') // Dashed line for nodes without coordinates
      .attr('stroke-opacity', 0.5)
      .style('pointer-events', 'auto'); // Make the lines interactable for highlighting
    // ===== OUTER DOTS =====
const gDots = svg.append('g').attr('class', 'outer-dots');

gDots.selectAll('circle')
  .data(allOuterNodes)
  .enter()
  .append('circle')
  .attr('cx', d => d.x)
  .attr('cy', d => d.y)
  .attr('r', 5)
  .attr("fill", d => topicColorMap(d.group)) // Assuming topicColorMap is defined
  .attr('stroke', '#888')
  .attr('stroke-opacity', 0.7)
  .attr('stroke-width', 1)
  .style('pointer-events', 'auto');

// Add labels next to the circles
gDots.selectAll('text')
  .data(allOuterNodes)
  .enter()
  .append('text')
  .attr('x', d => d.x + 10) // Adjust the offset as needed
  .attr('y', d => d.y)
  .attr('dy', -8)
  .attr('fill', '#000')
  .attr('font-size', '12px')
  .attr('text-anchor', 'middle') // Align text to the left of the circle
  .text(d => d.name)
  .style('opacity', 0) // Initially hidden

    // Rectangles at start and end of the arc
    arcGroups.append('rect')
      .attr('class', 'arc-end')
      .attr('width', 6)
      .attr('height', 6)
      .attr("fill", d => topicColorMap(d.source.group)) // Target color
      .attr('x', d => {
        const laneRadius = Math.min(d.rSource, d.rTarget) - LANE_SPACING;
        const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
        return cx + laneRadius * Math.cos(endAngle) - 3;
      })
      .attr('y', d => {
        const laneRadius = Math.min(d.rSource, d.rTarget) - LANE_SPACING;
        const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
        return cy + laneRadius * Math.sin(endAngle) - 3;
      })
      .attr('transform', d => {
        const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
        const angleDeg = endAngle * 180 / Math.PI;
        const x = cx + (Math.min(d.rSource, d.rTarget) - LANE_SPACING) * Math.cos(endAngle);
        const y = cy + (Math.min(d.rSource, d.rTarget) - LANE_SPACING) * Math.sin(endAngle);
        return `rotate(${angleDeg}, ${x}, ${y})`;
      });
    arcGroups.append('rect')
      .attr('class', 'arc-end')
      .attr('width', 6)
      .attr('height', 6)
      .attr("fill", d => topicColorMap(d.target.group)) // Source color
      .attr('x', d => {
        const laneRadius = Math.min(d.rSource, d.rTarget) - LANE_SPACING;
        const startAngle = d.source.angle;
        return cx + laneRadius * Math.cos(startAngle) - 3;
      })
      .attr('y', d => {
        const laneRadius = Math.min(d.rSource, d.rTarget) - LANE_SPACING;
        const startAngle = d.source.angle;
        return cy + laneRadius * Math.sin(startAngle) - 3;
      })
      .attr('transform', d => {
        const startAngle = d.source.angle;
        const angleDeg = startAngle * 180 / Math.PI;
        const x = cx + (Math.min(d.rSource, d.rTarget) - LANE_SPACING) * Math.cos(startAngle);
        const y = cy + (Math.min(d.rSource, d.rTarget) - LANE_SPACING) * Math.sin(startAngle);
        return `rotate(${angleDeg}, ${x}, ${y})`;
      });

// ===== HOVER INTERACTIONS =====
    // Hover helper: highlight related arcs and connectors

    const hoveredNodes = new Set();
function highlightNode(svg, nodeId, on) {
  if (on) {
    hoveredNodes.add(nodeId);
  } else {
    hoveredNodes.delete(nodeId);
  }

  const stillActive = hoveredNodes.has(nodeId);
  svg.selectAll(`.connector-${nodeId}`).classed('highlight', stillActive);
  svg.selectAll(`.nocoordconnector-${nodeId}`).classed('highlight', stillActive);
  svg.selectAll(`.arc-group.arc-${nodeId}`).classed('highlight', stillActive);
   svg.selectAll(`text`).filter(d => d.id === nodeId)
      .style('opacity', stillActive ? 1 : 0); // Show label on highlight
  
}


    // Arc hover
arcGroups
  .on('mouseenter', function (event, d) {
    d3.select(this).classed('highlight', true);
    highlightNode(svg, d.source.id, true);
    highlightNode(svg, d.target.id, true);

    // Highlight all no-coord connectors
    //svg.selectAll('.nocoordconnector-Max.Dudler').classed('highlight', true);
  })
  .on('mouseleave', function (event, d) {
    d3.select(this).classed('highlight', false);
    highlightNode(svg, d.source.id, false);
    highlightNode(svg, d.target.id, false);

    // Unhighlight all no-coord connectors
    //svg.selectAll('.nocoordconnector').classed('highlight', false);
  });


    // Connector hover
    connectors
      .on('mouseenter', function (event, d) {
        d3.select(this).classed('highlight', true);
        highlightNode(svg, d.id, true);

        // Highlight arcs related to this node
        outerLinks.forEach(link => {
          if (link.source.id === d.id || link.target.id === d.id) {
            highlightNode(svg, link.source.id, true);
            highlightNode(svg, link.target.id, true);
          }
        });
     
      })
.on('mouseleave', function (event, d) {
  d3.select(this).classed('highlight', false);
  highlightNode(svg, d.id, false);

  outerLinks.forEach(link => {
    if (link.source.id === d.id || link.target.id === d.id) {
      highlightNode(svg, link.source.id, false);
      highlightNode(svg, link.target.id, false);
    }
  });

});
    // NoCoordConnector hover
    noCoordLinks
      .on('mouseenter', function (event, d) {
        d3.select(this).classed('highlight', true);
        highlightNode(svg, d.id, true);

        // Highlight arcs related to this node
        outerLinks.forEach(link => {
          if (link.source.id === d.id || link.target.id === d.id) {
            highlightNode(svg, link.source.id, true);
            highlightNode(svg, link.target.id, true);
              
          }
        });
      })
.on('mouseleave', function (event, d) {
  d3.select(this).classed('highlight', false);
  highlightNode(svg, d.id, false);

  outerLinks.forEach(link => {
    if (link.source.id === d.id || link.target.id === d.id) {
      highlightNode(svg, link.source.id, false);
      highlightNode(svg, link.target.id, false);
    }
  });
});

    // ===== CSS HIGHLIGHT STYLE =====
    svg.append('style').text(`
      .arc-group.highlight .arc-path {
        stroke: #d33 !important;
        stroke-width: 2.5 !important;
      }
      .connector.highlight {
        stroke: #d33 !important;
        stroke-width: 3 !important;
      }
      .nocoordconnector.highlight {
        stroke: #d33 !important;
        stroke-width: 3 !important;
      }
    `);
  }

  function init() {
    const container = document.getElementById('chart') || document.body;
    if (!container) return;
    // Draw initially
    draw(container);
    // Keep redrawing when container resizes
    const resizeObs = new ResizeObserver(() => draw(container));
    resizeObs.observe(container);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();