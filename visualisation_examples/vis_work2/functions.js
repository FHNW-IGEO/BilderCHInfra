// Parse coordinates from a string
export function parseCoords(coordStr) {
    if (typeof coordStr === 'string' && coordStr.includes(',')) {
        const [lat, lon] = coordStr.split(',').map(s => parseFloat(s.trim()));
        if (!isNaN(lat) && !isNaN(lon)) return [lon, lat];
    }
    return null;
}

// Create an SVG overlay
export function createOverlaySVG(container, OVERLAY_ID) {
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
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
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

// Generate an arc path
export function arcPath(cx, cy, r, startAngle, endAngle) {
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

// ===== HOVER LOGIC =====
const hoveredNodes = new Set();
export function highlightNode(svg, nodeId, on, ITEM_OPACITY_HIGH, ITEM_OPACITY_MID, ITEM_OPACITY_LOW) {
    if (on) hoveredNodes.add(nodeId);
    else hoveredNodes.delete(nodeId);

    const active = hoveredNodes.has(nodeId);
    svg.selectAll(`.connector-${nodeId}, .nocoordconnector-${nodeId}`)
        .classed('highlight', active)
        .style("stroke-linecap", "round")
        .attr('stroke-opacity', active ? ITEM_OPACITY_HIGH : ITEM_OPACITY_MID)

    svg.selectAll(`.arc-path-${nodeId}`)
        .attr('stroke', active ? '#070157' : '#646464ff')
        .attr('stroke-width', active ? 2.5 : 0.7)
        .attr('stroke-opacity', active ? ITEM_OPACITY_HIGH : ITEM_OPACITY_HIGH)

    svg.selectAll('text:not(.legend-text)')
        .filter(d => d && d.id === nodeId)
        .style('opacity', active ? ITEM_OPACITY_HIGH : ITEM_OPACITY_MID)

    svg.selectAll(`.geom-${nodeId} path`)
        .transition()
        .duration(200)
        .attr("opacity", active ? ITEM_OPACITY_HIGH : ITEM_OPACITY_LOW);
    return null;
}

// helper for evenly spaced radii
export function assignRadiusLines(outerLinks, LANE_SPACING) {
    const laneRadii = outerLinks.map(d => Math.min(d.rSource, d.rTarget) - LANE_SPACING);
    const minR = Math.min(...laneRadii);
    const maxR = Math.max(...laneRadii);

    return laneRadii.map((_, i) =>
        minR + (i / (laneRadii.length - 1)) * (maxR - minR)
    );
}

export function calculateConnectorCoordinates(d, cx, cy, offset = 6) {
    const dx = d.x - cx;
    const dy = d.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
        x1: d.x + (dx / len) * offset,
        y1: d.y + (dy / len) * offset,
        x2: d.inner?.proj ? d.inner.proj[0] : d.x,
        y2: d.inner?.proj ? d.inner.proj[1] : d.y
    };
}

// ===== HIGHLIGHT FUNCTION =====
export function highlightThema(themaName, nodeSelection) {
    // Highlight network + map nodes
    nodeSelection
        .transition().duration(200)
        .attr('opacity', d => {
            return (d.group === themaName || (d.group === 'thema' && d.name === themaName)) ? 0.9 : 0.05;
        });

    // Highlight outer overlay nodes
    d3.selectAll('.outer-dots circle')
        .transition().duration(200)
        .attr('opacity', d => d.group === themaName ? 0.9 : 0.05)

    // Highlight overlay labels
    d3.selectAll('.outer-dots .label text')
        .transition().duration(200)
        .attr('opacity', d => d.group === themaName ? 0.9 : 0.05);


    // Highlight overlay labels
    d3.selectAll('.arc-end')
        .transition().duration(200)
        .attr('opacity', d => (d.source.group === themaName || d.target.group === themaName) ? 0.9 : 0.05);

    // Highlight overlay labels
    d3.selectAll('.arc-group')
        .transition().duration(200)
        .attr('opacity', d => (d.source.group === themaName || d.target.group === themaName) ? 0.9 : 0.05);

    // Highlight connectors
    d3.selectAll('.ring-links line')
        .transition().duration(200)
        .attr('stroke-opacity', d => d.group === themaName ? 0.9 : 0.05);


    // Highlight connectors
    d3.selectAll('.nocoordconnector')
        .transition().duration(200)
        .attr('stroke-opacity', d => d.group === themaName ? 0.9 : 0.05);

    return null
}

// Compute ranges for each node's minimum and maximum column (used for layout)
export function computeRanges(data) {
    const nodeMap = Object.fromEntries(data.nodes.map((d, i) => [d.id, i]));
    for (let i = 0; i < data.links.length; i++) {
        const link = data.links[i];
        const source = data.nodes[nodeMap[link.source]];
        const target = data.nodes[nodeMap[link.target]];
        source.minCol = Math.min(source.minCol, i);
        source.maxCol = Math.max(source.maxCol, i);
        target.minCol = Math.min(target.minCol, i);
        target.maxCol = Math.max(target.maxCol, i);
    }
}

export function initGraph(data) {
    // Set up each node's initial properties (e.g., row, degree, and neighbors)
    for (let node of data.nodes) {
        node.row = -1;
        node.degree = 0;
        node.neighbors = [];
        node.minCol = Number.MAX_SAFE_INTEGER;
        node.maxCol = Number.MIN_SAFE_INTEGER;
    }

    // Create a map of node IDs to their indices in the data array
    const nodeMap = Object.fromEntries(data.nodes.map((d, i) => [d.id, i]));

    // Filter out links with invalid source or target nodes
    const invalidLinks = data.links.filter(link => nodeMap[link.source] === undefined || nodeMap[link.target] === undefined);
    if (invalidLinks.length > 0) {
        console.warn('Invalid links found:', invalidLinks);
    }
    data.links = data.links.filter(link => nodeMap[link.source] !== undefined && nodeMap[link.target] !== undefined);

    // Link nodes together by updating their degree and neighbors based on the links data
    for (let link of data.links) {
        const source = data.nodes[nodeMap[link.source]];
        const target = data.nodes[nodeMap[link.target]];
        source.degree++;
        target.degree++;
        source.neighbors.push(target);
        target.neighbors.push(source);
    }
}
// Load Switzerland map as a background layer for the network visualization
export function loadSwitzerlandMap(svg, projection, SWISSMAP) {
    d3.json(SWISSMAP).then(function(switzerland) {
        const mapLayer = svg.append("g").attr("class", "map-layer").lower();
        const geoPathGenerator = d3.geoPath().projection(projection);
        // Add map paths (features) from Switzerland GeoJSON
        mapLayer.selectAll("path")
            .data(switzerland.features)
            .enter()
            .append("path")
            .attr("d", geoPathGenerator)
            .attr("fill", "#e0e0e0")
            .style("opacity", 1);
    });
}