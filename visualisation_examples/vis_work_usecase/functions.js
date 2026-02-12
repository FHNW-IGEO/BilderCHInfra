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
        .style('pointer-events', 'none')
    // ensure overlay sits below the main SVG by default so main content (thema nodes, legend) can be raised
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

// TODO
// ===== HOVER LOGIC =====
const hoveredNodes = new Set();
export function highlightNode(svg, nodeId, on, ITEM_OPACITY_HIGH, ITEM_OPACITY_MID, ITEM_OPACITY_LOW) {
    if (on) hoveredNodes.add(nodeId);
    else hoveredNodes.delete(nodeId);

    const active = hoveredNodes.has(nodeId);
    // If a thema is active, only allow highlighting for nodes that belong to that thema.
    try {
        const activeThema = typeof getActiveThema === 'function' ? getActiveThema() : null;
        if (activeThema) {
            // attempt to locate a bound datum for the given nodeId
            let nodeDatum = null;
            // search common groups where node data is bound
            svg.selectAll('.geom-group, .label, line.connector, line.nocoordconnector')
                .each(function(d) {
                    if (d && d.id === nodeId) nodeDatum = d;
                });
            if (nodeDatum && nodeDatum.group && nodeDatum.group !== activeThema) {
                // a different thema is active; skip visual highlight for this node
                return null;
            }
        }
    } catch (e) {
        // if anything goes wrong, fall back to normal behavior
    }
    //svg.selectAll(`.connector-${nodeId}, .nocoordconnector-${nodeId}`)
    //    .classed('highlight', active)
    //    .style("stroke-linecap", "round")
    //    .attr('stroke-opacity', active ? ITEM_OPACITY_HIGH : ITEM_OPACITY_MID)

    //svg.selectAll(`.arc-path-${nodeId}`)
    //    .attr('stroke', active ? '#070157' : '#646464ff')
    //    .attr('stroke-width', active ? 2.5 : 0.7)
    //    .attr('stroke-opacity', active ? ITEM_OPACITY_HIGH : ITEM_OPACITY_MID)

    //svg.selectAll(`.geom-${nodeId} path`)
    //    .transition()
    //    .duration(200)
    //    .attr("opacity", active ? ITEM_OPACITY_HIGH : ITEM_OPACITY_LOW);
    return null;
}

// Track which "thema" is currently highlighted (in foreground). Other modules can
// query this to disable hover/click interactions for nodes not in the foreground.
let activeThema = null;
export function setActiveThema(name) {
    activeThema = name || null;
}
export function getActiveThema() {
    return activeThema;
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
        .attr('opacity', d => {
            return (d.group === themaName || (d.group === 'thema' && d.name === themaName)) ? 0.9 : 0.05;
        });

    // Highlight outer overlay nodes
    d3.selectAll('.outer-dots circle')
        .attr('opacity', d => d.group === themaName ? 0.9 : 0.05)

    d3.selectAll('.label text')
        .attr('opacity', d => d.group === themaName ? 1 : 1);


    // Highlight overlay labels
    d3.selectAll('.arc-end')
        .attr('opacity', d => (d.source.group === themaName || d.target.group === themaName) ? 0.9 : 0.05);

    // Highlight overlay labels
    d3.selectAll('.arc-group')
        .attr('opacity', d => (d.source.group === themaName || d.target.group === themaName) ? 0.9 : 0.05);

    // Highlight connectors
    d3.selectAll('.ring-links line')
        .attr('stroke-opacity', d => d.group === themaName ? 0.7 : 0.05);

    // Highlight connectors without coordinates
    d3.selectAll('.nocoordconnector')
        .attr('stroke-opacity', d => d.group === themaName ? 0.9 : 0.05);

    // Highlight geometry paths
    d3.selectAll('.link-geom').attr('opacity', 1).attr('stroke-opacity', 0);
    d3.selectAll('.link-geom-group').attr('stroke-opacity', 0)
        .attr('stroke-opacity', d => (d.source.group === themaName || d.target.group === themaName) ? 0.9 : 0.05);

    // Record active thema so other code (hover/click) can disable interactions for other nodes
    setActiveThema(themaName);

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
        const mapLayer = svg.append("g").attr("class", "map-layer");
        // ensure the map layer is beneath all other groups in the main SVG
        mapLayer.lower();
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


export function descriptiveLegend(nodesRaw, svg) {
    const numThemaNodes = nodesRaw.filter(d => d.group === "thema").length;
    const legendStartY = 55 + numThemaNodes * 20 + 20; // 50=startY, 20=offset, +20 padding
    const legendGroup = svg.append('g')
        .attr('class', 'network-legend')
        .attr('transform', `translate(100, ${legendStartY})`);

    // Keep legend on top
    legendGroup.raise();
    const legendItems = [{
            type: 'arc',
            label: 'Beziehungen'
        },
        {
            type: 'dashed-line',
            label: 'Immaterielles Netzwerk'
        },
        {
            type: 'solid-line',
            label: 'Materielles Netzwerk'
        },
        {
            type: 'rect',
            label: 'Beziehungspunkt'
        }
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
                .attr('x', x + 2)
                .attr('y', y - 5)
                .attr('width', 5)
                .attr('height', 5)
                .attr('fill', '#646464ff');
        }

        legendGroup.append('text')
            .attr('class', 'legend-text')
            .attr('x', x + 20)
            .attr('y', y + 4)
            .text(item.label)
            .attr('font-size', 12)
            .attr('fill', '#000000')
            .attr('font-family', 'sans-serif');
        yOffset += 25;
    });
}


export function hoverMouseEnter(arcGroups, svg, getArcClassFromElement, getConnectorClassFromElement, selectedElements, ITEM_OPACITY_LOW, ITEM_OPACITY_MID, ITEM_OPACITY_HIGH) {
    arcGroups.on('mouseenter', (event, d) => {
        const activeThema = getActiveThema();
        const isThemaActive = activeThema && (d.source.group !== activeThema && d.target.group !== activeThema);

        if (isThemaActive) return;

        // Dim all other elements except selected ones
        svg.selectAll('.arc-path, .connector, .arc-end')
            .filter(function() {
                const el = this;
                const arcClass = getArcClassFromElement(el);
                const connClass = getConnectorClassFromElement(el);
                return !(arcClass && selectedElements.has(arcClass)) && !(connClass && selectedElements.has(connClass));
            })
            .attr('opacity', ITEM_OPACITY_MID);

        // Show the arc label
        d3.select(event.currentTarget).select('.arc-label').attr('opacity', 1);

        // Highlight connected link geometries
        const highlightLinks = svg.selectAll(`.link-geom-${d.source.id}-${d.target.id} path`);
        const allLinks = svg.selectAll('.link-geom-group path');

        if (!activeThema) {
            allLinks.filter(geom => geom.source.id === d.source.id || geom.source.id === d.target.id ||
                    geom.target.id === d.source.id || geom.target.id === d.target.id
                )
                .attr('stroke-width', 1.5)
                .attr('opacity', ITEM_OPACITY_HIGH);

            highlightLinks.attr('stroke-width', 2.5).attr('opacity', ITEM_OPACITY_HIGH);
        } else {
            allLinks.filter(geom => (geom.source.group === activeThema || geom.target.group === activeThema) &&
                    (geom.source.id === d.source.id || geom.source.id === d.target.id ||
                        geom.target.id === d.source.id || geom.target.id === d.target.id)
                )
                .attr('stroke-width', 1.5)
                .attr('opacity', ITEM_OPACITY_HIGH);

            highlightLinks.filter(geom => geom.source.group === activeThema || geom.target.group === activeThema)
                .attr('stroke-width', 2.5)
                .attr('opacity', ITEM_OPACITY_HIGH);
        }

        // Highlight connected arcs
        svg.selectAll(`.arc-path.arc-path-${d.source.id}, .arc-path.arc-path-${d.target.id}`)
            .filter(function() {
                const arcClass = getArcClassFromElement(this);
                return arcClass !== `arc-${d.source.id}-${d.target.id}` && !selectedElements.has(arcClass);
            })
            .attr('stroke', '#000000ff')
            .attr('stroke-width', 0.7)
            .attr('opacity', 1)
            .attr('stroke-opacity', ITEM_OPACITY_HIGH);

        // Highlight hovered arcs
        svg.selectAll(`.arc-${d.source.id}-${d.target.id}`)
            .attr('stroke', '#000000ff')
            .attr('stroke-width', 2.5)
            .attr('opacity', 1)
            .attr('stroke-opacity', ITEM_OPACITY_HIGH);

        svg.selectAll(`.connector-${d.source.id}, .connector-${d.target.id}`)
            .attr('opacity', 1)
            .attr('stroke-opacity', ITEM_OPACITY_HIGH);

        svg.selectAll(`[data-arc-class="arc-${d.source.id}-${d.target.id}"]`)
            .attr('opacity', 1)

    });
}

export function hoverMouseLeave(arcGroups, svg, getArcClassFromElement, getConnectorClassFromElement, selectedElements, ITEM_OPACITY_LOW, ITEM_OPACITY_MID, ITEM_OPACITY_HIGH) {
    arcGroups.on('mouseleave', (event, d) => {
        if (!event.ctrlKey) {
            // Hide the arc label
            d3.select(event.currentTarget).select('.arc-label').attr('opacity', 0);

            // Restore opacity of all elements except selected ones
            svg.selectAll('.arc-path, .connector, .arc-end')
                .filter(function() {
                    const el = this;
                    const arcClass = getArcClassFromElement(el);
                    const connClass = getConnectorClassFromElement(el);
                    return !(arcClass && selectedElements.has(arcClass)) && !(connClass && selectedElements.has(connClass));
                })
                .attr('opacity', 1);

            const resetLinks = svg.selectAll(`.link-geom-${d.source.id}-${d.target.id} path`);
            const allLinks = svg.selectAll('.link-geom-group path');

            if (!getActiveThema()) {
                resetLinks.attr('stroke-width', 0.7).attr('opacity', ITEM_OPACITY_MID);

                allLinks.filter(function() {
                        const arcClass = getArcClassFromElement(this);
                        return !selectedElements.has(arcClass);
                    })
                    .attr('stroke-width', 1)
                    .attr('opacity', ITEM_OPACITY_MID);

                svg.selectAll(`.connector-${d.source.id}, .connector-${d.target.id}`)
                    .attr('stroke-opacity', ITEM_OPACITY_MID);

                svg.selectAll(`.arc-end-${d.source.id}, .arc-end-${d.target.id}`)
                    .attr('stroke-opacity', ITEM_OPACITY_MID);

            } else {
                resetLinks.filter(geom => geom.source.group === getActiveThema() || geom.target.group === getActiveThema())
                    .attr('stroke-width', 0.7)
                    .attr('opacity', ITEM_OPACITY_MID);

                allLinks.filter(function() {
                        const arcClass = getArcClassFromElement(this);
                        return !selectedElements.has(arcClass);
                    })
                    .attr('stroke-width', 1)
                    .attr('opacity', ITEM_OPACITY_MID);
            }

            // Reset connected arcs
            svg.selectAll(`.arc-path.arc-path-${d.source.id}, .arc-path.arc-path-${d.target.id}`)
                .filter(function() {
                    const arcClass = getArcClassFromElement(this);
                    return !selectedElements.has(arcClass);
                })
                .attr('stroke', '#646464ff')
                .attr('stroke-width', 0.7)
                .attr('opacity', 1)
                .attr('stroke-opacity', 0.11111);


            svg.selectAll(`.connector-${d.source.id}, .connector-${d.target.id}`).filter(geom => {console.log(geom); return geom.source.group === getActiveThema() || geom.target.group === getActiveThema()})
                .attr('stroke-opacity', ITEM_OPACITY_MID);

            svg.selectAll(`.arc-end-${d.source.id}, .arc-end-${d.target.id}`).filter(geom => geom.source.group === getActiveThema() || geom.target.group === getActiveThema())
                .attr('stroke-opacity', ITEM_OPACITY_MID);
        }

    });
}

// TODO: setter getter SelectedElements aufbauen?
export function hoverClick(arcGroups, selectedElements, ITEM_OPACITY_LOW, ITEM_OPACITY_MID, ITEM_OPACITY_HIGH) {
    arcGroups.on('click', (event, d) => {
        if (!event.ctrlKey) return;
        const arcClass = `arc-${d.source.id}-${d.target.id}`;

        if (selectedElements.has(arcClass)) {
            // Deselect
            selectedElements.delete(arcClass);
            d3.selectAll(`.${arcClass}`)
                .attr('stroke', () => d3.select(this).attr('data-default-stroke') || '#646464ff')
                .attr('stroke-width', () => d3.select(this).attr('data-default-width') || 0.7)
                .attr('stroke-opacity', ITEM_OPACITY_MID)
                .attr('data-selected', null);

            d3.selectAll(`.link-geom-${d.source.id}-${d.target.id} path`)
                .attr('stroke-width', 0.7)
                .attr('opacity', ITEM_OPACITY_MID);
        } else {
            // Select
            selectedElements.add(arcClass);
            d3.selectAll(`.${arcClass}`)
                .attr('stroke', '#ff0000')
                .attr('stroke-width', 2)
                .attr('stroke-opacity', 1)
                .attr('data-selected', 'true');

            d3.selectAll(`.link-geom-${d.source.id}-${d.target.id} path`)
                .attr('stroke-width', 2.5)
                .attr('opacity', ITEM_OPACITY_HIGH);
        }
    });
}

export function getArcClassFromElement(el) {
    if (!el) return null;
    const classes = el.getAttribute && el.getAttribute('class') || '';
    const cls = classes.split(/\s+/);
    let arcClass = cls.find(c => c.startsWith('arc-') && c.split('-').length >= 3);
    if (!arcClass && el.parentNode && el.parentNode.getAttribute) {
        const pcls = el.parentNode.getAttribute('class') || '';
        arcClass = pcls.split(/\s+/).find(c => c.startsWith('arc-') && c.split('-').length >= 3);
    }
    return arcClass || null;
}

// Helper: find connector class (connector-<id>) from an element
export function getConnectorClassFromElement(el) {
    if (!el) return null;
    const classes = el.getAttribute && el.getAttribute('class') || '';
    return classes.split(/\s+/).find(c => c.startsWith('connector-')) || null;
}
