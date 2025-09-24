(function() {
  const DATA_URL = 'data3.json';
    const GEOM_URL = 'geom.geojson';
  const OVERLAY_ID = 'network-overlay-svg';
  const MAP_CENTER = [8.3, 46.8];
  const MAP_SCALE = 6000;
  const RADIUS_RATIO = 0.25;
  const DOT_OUT_OFFSET = 6;
  const LANE_SPACING = 6;
  const LINK_COLOR = '#cdcecfff';
  const RING_COLOR = '#b6b7b8ff';

  function parseCoords(coordStr) {
    if (typeof coordStr === 'string' && coordStr.includes(',')) {
      const [lat, lon] = coordStr.split(',').map(s => parseFloat(s.trim()));
      if (!isNaN(lat) && !isNaN(lon)) return [lon, lat];
    }
    return null;
  }

  function createOverlaySVG(container) {
    const prev = container.querySelector(`#${OVERLAY_ID}`);
    if (prev) prev.remove();
    const {
      width,
      height
    } = container.getBoundingClientRect();
    if (!width || !height) return null;
    const svg = d3.select(container)
      .append('svg')
      .attr('id', OVERLAY_ID)
      .attr('width', width)
      .attr('height', height)
      .style('position', 'absolute')
      .style('inset', 0)
      .style('pointer-events', 'none');
    return {
      svg,
      width,
      height
    };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    let a0 = (startAngle + 2 * Math.PI) % (2 * Math.PI);
    let a1 = (endAngle + 2 * Math.PI) % (2 * Math.PI);
    let delta = a1 - a0;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
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
    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * RADIUS_RATIO;
    const projection = d3.geoMercator()
      .center(MAP_CENTER)
      .scale(MAP_SCALE)
      .translate([cx, cy]);
    let sampleData;
    try {
      const resp = await fetch(DATA_URL);
      sampleData = await resp.json();
      const resp_geom = await fetch(GEOM_URL);
      geomData = await resp_geom.json();
    } catch (e) {
      console.error('Failed to load data', e);
      return;
    }
    const nodesRaw = sampleData.nodes || [];
  
    // Merge geometry into nodes before any filtering
nodesRaw.forEach(n => {
  console.log(n)
    const match = geomData.features.find(f => f.properties.gehoert_zu === n.id);
    n.geometry = match ? match.geometry : n.geometry;
  
});
console.log(nodesRaw)
    const innerNodes = nodesRaw
      .filter(n => n.group !== 'thema')
      .map(n => {
        const proj = parseCoords(n.koordinaten) ? projection(parseCoords(n.koordinaten)) : null;
        return {
          ...n,
          proj
        };
      })
      .filter(n => n.proj);
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
    const outerNoCoordsNodes = nodesRaw
      .filter(n => n.koordinaten === null)
      .map((n, i) => {
        const r = baseRadius + DOT_OUT_OFFSET + (innerNodes.length + i) * LANE_SPACING;
        const angle = (i * 2 * Math.PI) / nodesRaw.length;
        return {
          ...n,
          angle,
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle)
        };
      });
    const allOuterNodes = outerNodes.concat(outerNoCoordsNodes);
    // ===== ORIENTATION CIRCLE =====
    svg.append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2)
      .attr('fill', 'none')
      .attr('stroke', RING_COLOR)
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.1);
    // ===== CONNECTORS =====
    const gLinks = svg.append('g').attr('class', 'ring-links');
    // Visible lines
    const connectors = gLinks.selectAll('line')
      .data(allOuterNodes)
      .enter()
      .append('line')
      .attr('class', d => `connector connector-${d.id}`)
      .attr('x1', d => d.x)
      .attr('y1', d => d.y)
      .attr('x2', d => d.inner?.proj ? d.inner.proj[0] : d.x)
      .attr('y2', d => d.inner?.proj ? d.inner.proj[1] : d.y)
      .attr('stroke', "black")
      .attr('stroke-width', 0.8)
      .attr('stroke-opacity', 1)
      .style('pointer-events', 'none');
    // Hitboxes
    gLinks.selectAll('.connector-hitbox')
      .data(allOuterNodes)
      .enter()
      .append('line')
      .attr('class', d => `connector-hitbox connector-hitbox-${d.id}`)
      .attr('x1', d => d.x)
      .attr('y1', d => d.y)
      .attr('x2', d => d.inner?.proj ? d.inner.proj[0] : d.x)
      .attr('y2', d => d.inner?.proj ? d.inner.proj[1] : d.y)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10)
      .style('pointer-events', 'stroke')
      .on('mouseenter', (event, d) => highlightNode(svg, d.id, true))
      .on('mouseleave', (event, d) => highlightNode(svg, d.id, false));
    connectors.lower();
    // ===== OUTER RELATIONSHIPS (INNER LANE ARCS) =====
    const outerLinks = (sampleData.links || [])
      .map(l => {
        const source = allOuterNodes.find(n => n.id === l.source);
        const target = allOuterNodes.find(n => n.id === l.target);
        if (!source || !target) return null;
        return {
          source,
          target,
          rSource: Math.hypot(source.x - cx, source.y - cy),
          rTarget: Math.hypot(target.x - cx, target.y - cy),
          angle: Math.atan2(target.y - cy, target.x - cx)
        };
      }).filter(d => d);
    const gOuterLinks = svg.append('g').attr('class', 'outer-links');
    const arcGroups = gOuterLinks.selectAll('g.arc-group')
      .data(outerLinks)
      .enter()
      .append('g')
      .attr('class', d => `arc-group arc-${d.source.id} arc-${d.target.id}`);
    const drawArc = d => {
      const laneRadius = Math.min(d.rSource, d.rTarget) - LANE_SPACING;
      const startAngle = d.source.angle;
      const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
      return arcPath(cx, cy, laneRadius, startAngle, endAngle);
    };
    arcGroups.append('path')
      .attr('class', 'arc-path')
      .attr('d', drawArc)
      .attr('stroke', '#646464ff')
      .attr('stroke-width', 0.7)
      .attr('stroke-opacity', 0.9)
      .attr('fill', 'none')
      .style('pointer-events', 'auto');
    arcGroups.append('path')
      .attr('class', 'arc-hitbox')
      .attr('d', drawArc)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10)
      .attr('fill', 'none')
      .style('pointer-events', 'stroke');
    // ===== NO-COORD LINKS =====
    const gNoCoordLinks = svg.append('g').attr('class', 'no-coord-links');
    const drawNoCoord = d => {
      const angle = Math.atan2(d.y - cy, d.x - cx);
      const r = baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2;
      return {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      };
    };
    gNoCoordLinks.selectAll('line')
      .data(outerNoCoordsNodes)
      .enter()
      .append('line')
      .attr('class', d => `nocoordconnector nocoordconnector-${d.id}`)
      .attr('x1', d => d.x)
      .attr('y1', d => d.y)
      .attr('x2', d => drawNoCoord(d).x)
      .attr('y2', d => drawNoCoord(d).y)
      .attr('stroke', LINK_COLOR)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8)
      .attr('stroke-dasharray', '4 2')
      .style('pointer-events', 'none');
    gNoCoordLinks.selectAll('.nocoordconnector-hitbox')
      .data(outerNoCoordsNodes)
      .enter()
      .append('line')
      .attr('class', d => `nocoordconnector-hitbox nocoordconnector-hitbox-${d.id}`)
      .attr('x1', d => d.x)
      .attr('y1', d => d.y)
      .attr('x2', d => drawNoCoord(d).x)
      .attr('y2', d => drawNoCoord(d).y)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10)
      .style('pointer-events', 'stroke')
      .on('mouseenter', (event, d) => highlightNode(svg, d.id, true))
      .on('mouseleave', (event, d) => highlightNode(svg, d.id, false));
    // ===== OUTER DOTS & LABELS =====
     const gDots = svg.append('g').attr('class', 'outer-dots');
    gDots.selectAll('circle')
      .data(allOuterNodes)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 5)
      .attr('fill', d => topicColorMap(d.group))
      .attr('stroke', '#888')
      .attr('stroke-opacity', 0.7)
      .attr('stroke-width', 1)
      .style('pointer-events', 'auto');
const centerX = width / 2;  // Replace with your actual center
const centerY = height / 2;

 const labels = gDots.selectAll('.label')
  .data(allOuterNodes)
  .enter()
  .append('g')   // group for rect + text
  .attr('class', 'label')
  .attr('transform', d => {
    const dx = d.x - centerX;
    const dy = d.y - centerY;
    const length = Math.sqrt(dx*dx + dy*dy);
    const offset =10;
    return `translate(${d.x + (dx / length) * offset}, ${d.y + (dy / length) * offset})`;
  });

// add text
labels.append('text')
  .attr('font-size', '10px')
  .attr('text-anchor', d => (d.x < centerX ? 'end' : 'start'))
  .attr('dy', '0.35em')
  .attr('opacity', 0.5)
  .text(d => d.name)
   // ===== ARC END RECTANGLES =====
    const addArcRect = (group, pos, angle) => {
      const laneRadius = Math.min(pos.rSource, pos.rTarget) - LANE_SPACING;
      const x = cx + laneRadius * Math.cos(angle) - 3;
      const y = cy + laneRadius * Math.sin(angle) - 3;
      group.append('rect')
        .attr('class', 'arc-end')
        .attr('width', 6)
        .attr('height', 6)
        .attr('fill', topicColorMap(pos[pos === pos.source ? 'source' : 'target'].group))
        .attr('x', x)
        .attr('y', y)
        .attr('transform', `rotate(${angle * 180 / Math.PI}, ${x + 3}, ${y + 3})`);
    };
    arcGroups.each(function(d) {
      addArcRect(d3.select(this), d, d.source.angle);
      addArcRect(d3.select(this), d, Math.atan2(d.target.y - cy, d.target.x - cx));
    });

    // ===== GEOMETRY PATHS =====
const gGeomPaths = svg.append("g").attr("class", "geom-paths");
console.log(gGeomPaths);

gGeomPaths.selectAll("g.geom-group")
  .data(innerNodes.filter(d => d.geometry))
  .enter()
  .append("g")
  .attr("class", d => `geom-group geom-${d.id}`)
  .each(function(d) {
    const group = d3.select(this);
    let coordinates = [];

    // Check if the geometry is a LINESTRING or MULTILINESTRING
    console.log(d.geometry)
    if (d.geometry.type === "LineString") {
      console.log("___")
      coordinates = [d.geometry.coordinates]; // Wrap the coordinates in an array to handle uniformly
    } else if (d.geometry.type === "MultiLineString") {
      console.log("OLA")
      coordinates = d.geometry.coordinates;
    }

    // Loop over each line in the geometry (for MultiLineString)
    coordinates.forEach(line => {
      const pathData = line.map(coord => {
        if (!Array.isArray(coord) || coord.length < 2) return null;
        const [lon, lat] = coord; // Assuming coordinates are [longitude, latitude]
        const [x, y] = projection([lon, lat]); // Project the coordinates (longitude, latitude)
        return `${x},${y}`;
      }).filter(Boolean).join("L");

      if (!pathData) return;

      const pathString = `M${pathData}`;

      group.append("path")
        .attr("d", pathString)
        .attr("fill", "none")
        .attr("stroke", "#2c2c2cff")
        .attr("stroke-width", 1)
        .attr("opacity", 0.1)   // invisible until hover
        .style("pointer-events", "none");
    });
  });


    // ===== HOVER LOGIC =====
    const hoveredNodes = new Set();

    function highlightNode(svg, nodeId, on) {
      if (on) hoveredNodes.add(nodeId);
      else hoveredNodes.delete(nodeId);
      const active = hoveredNodes.has(nodeId);
      svg.selectAll(`.connector-${nodeId}, .nocoordconnector-${nodeId}, .arc-group.arc-${nodeId}`)
        .classed('highlight', active);
    svg.selectAll('text:not(.legend-text)')
  .filter(d => d && d.id === nodeId)
  .style('opacity', active ? 1 : 0.8)
    .attr('font-family', 'sans-serif');

      svg.selectAll(`.geom-${nodeId} path`)
    .transition()
    .duration(200)
    .attr("opacity", active ? 0.8 : 0.1);

    }
    // Arc hover
    arcGroups.on('mouseenter', (event, d) => {
      highlightNode(svg, d.source.id, true);
      highlightNode(svg, d.target.id, true);
    }).on('mouseleave', (event, d) => {
      highlightNode(svg, d.source.id, false);
      highlightNode(svg, d.target.id, false);
    });
    // Connector hover
    [...connectors.nodes(), ...gNoCoordLinks.selectAll('line').nodes()].forEach(line => {
      d3.select(line)
        .on('mouseenter', (event, d) => {
          highlightNode(svg, d.id, true);
          outerLinks.forEach(link => {
            if (link.source.id === d.id || link.target.id === d.id) {
              highlightNode(svg, link.source.id, true);
              highlightNode(svg, link.target.id, true);
            }
          });
        })
        .on('mouseleave', (event, d) => {
          highlightNode(svg, d.id, false);
          outerLinks.forEach(link => {
            if (link.source.id === d.id || link.target.id === d.id) {
              highlightNode(svg, link.source.id, false);
              highlightNode(svg, link.target.id, false);
            }
          });
        });
    });

// ===== LEGEND BELOW 'THEMA-NODE' =====
const numThemaNodes = nodes.filter(d => d.group === "thema").length;
const legendStartY = 55 + numThemaNodes * 20 + 20; // 50=startY, 20=offset, +20 padding

const legendGroup = svg.append('g')
  .attr('class', 'network-legend')
  .attr('transform', `translate(100, ${legendStartY})`);

const legendItems = [
  { type: 'arc', label: 'Beziehungen' },
  { type: 'dashed-line', label: 'Immaterielles Netzwerk' },
  { type: 'solid-line', label: 'Materielles Netzwerk' },
  { type: 'rect', label: 'Beziehungspunkt' }
];

let yOffset = 0;

legendItems.forEach(item => {
  const x = -5;
  const y = yOffset;

  if (item.type === 'arc') {
    legendGroup.append('path')
      .attr('d', arcPath(x + 5, y, 5, Math.PI, 0))
      .attr('stroke', '#646464ff')
      .attr('stroke-width', 1)
      .attr('fill', 'none');
  } else if (item.type === 'dashed-line') {
    legendGroup.append('line')
      .attr('x1', x)
      .attr('y1', y)
      .attr('x2', x + 10)
      .attr('y2', y)
      .attr('stroke', '#646464ff')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 2');
  } else if (item.type === 'solid-line') {
    legendGroup.append('line')
      .attr('x1', x)
      .attr('y1', y)
      .attr('x2', x + 10)
      .attr('y2', y)
      .attr('stroke', '#646464ff')
      .attr('stroke-width', 2);
  } else if (item.type === 'rect') {
    legendGroup.append('rect')
      .attr('x', x + 2 )
      .attr('y', y - 5)
      .attr('width', 5)
      .attr('height',5)
      .attr('fill', '#646464ff');
  }

legendGroup.append('text')
  .attr('class', 'legend-text')
  .attr('x', x + 20)
  .attr('y', y + 4)
  .text(item.label)
  .attr('font-size', 12)
  .attr('fill', '#333')
  .attr('font-family', 'sans-serif');

  yOffset += 25;
});

  }

  
  function init() {
    const container = document.getElementById('chart') || document.body;
    if (!container) return;
    draw(container);
    new ResizeObserver(() => draw(container)).observe(container);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();