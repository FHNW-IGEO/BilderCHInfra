/* network_overlay.js — Radial projection with concentric lanes per point
   - Shrinks map radius slightly so overlay fits better.
   - Each non-`thema` node projected onto map, then extended radially outward.
   - Each point gets its own lane by increasing radius incrementally.
   - Adds a single orientation circle around the map, just before first outer point.
   - Uses ResizeObserver so overlay always persists and updates on reload/resize.
*/
(function () {
  const DATA_URL = 'kraftwerke.json';
  const OVERLAY_ID = 'network-overlay-svg';

  const MAP_CENTER = [8.3, 46.8];
  const MAP_SCALE  = 6000; // slightly smaller scale to shrink map

  const RADIUS_RATIO   = 0.18; // smaller base ratio so everything fits
  const DOT_OUT_OFFSET = 6;
  const LANE_SPACING   = 6;
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

    return { svg, width: rect.width, height: rect.height };
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
  const { svg, width, height } = overlay;

  const cx = width / 2, cy = height / 2;
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
      return { ...n, proj };
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
    .attr('x2', d => d.inner.proj ? d.inner.proj[0] : d.x)  // fallback for no coordinates
    .attr('y2', d => d.inner.proj ? d.inner.proj[1] : d.y)  // fallback for no coordinates
    .attr('stroke', LINK_COLOR)
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.7)
    .style('pointer-events', 'auto');

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
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .style('pointer-events', 'auto');

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

      return { source, target, rSource, rTarget, angle };
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
    });

      // ===== CONNECTION LINES FOR NODES WITHOUT COORDINATES =====
const gNoCoordLinks = svg.append('g').attr('class', 'no-coord-links');

gNoCoordLinks.selectAll('line')
  .data(outerNoCoordsNodes)
  .enter()
  .append('line')
  .attr('x1', d => d.x)
  .attr('y1', d => d.y)
  .attr('x2', d => {
    // Calculate the angle from the center (cx, cy)
    const angle = Math.atan2(d.y - cy, d.x - cx);
    // Calculate the point on the orientation circle (radius = baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2)
    const r = baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2;
    return cx + r * Math.cos(angle);
  })
  .attr('y2', d => {
    // Calculate the angle from the center (cx, cy)
    const angle = Math.atan2(d.y - cy, d.x - cx);
    // Calculate the point on the orientation circle (radius = baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2)
    const r = baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2;
    return cy + r * Math.sin(angle);
  })
  .attr('stroke', '#888')
  .attr('stroke-width', 1)
  .attr('stroke-dasharray', '4 2')  // Dashed line for nodes without coordinates
  .attr('stroke-opacity', 0.5)
  .style('pointer-events', 'none');


  // ===== HOVER INTERACTION =====
  arcGroups.on('mouseenter', function (event, d) {
    d3.select(this).classed('highlight', true);
    svg.selectAll(`.connector-${d.source.id}, .connector-${d.target.id}`)
      .classed('highlight', true);
  }).on('mouseleave', function (event, d) {
    d3.select(this).classed('highlight', false);
    svg.selectAll(`.connector-${d.source.id}, .connector-${d.target.id}`)
      .classed('highlight', false);
  });

  connectors.on('mouseenter', function (event, d) {
    d3.select(this).classed('highlight', true);
    svg.selectAll(`.arc-${d.id}`).classed('highlight', true);
  }).on('mouseleave', function (event, d) {
    d3.select(this).classed('highlight', false);
    svg.selectAll(`.arc-${d.id}`).classed('highlight', false);
  });

  // ===== CSS HIGHLIGHT STYLE =====
  svg.append('style').text(`
    .highlight .arc-path {
      stroke: #d33 !important;
      stroke-width: 3 !important;
    }
    .highlight .arc-end {
      fill: #d33 !important;
      stroke: #d33 !important;
    }
    .highlight.connector {
      stroke: #d33 !important;
      stroke-width: 4 !important;
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
