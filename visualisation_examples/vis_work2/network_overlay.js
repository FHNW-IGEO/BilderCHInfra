(function() {
    const DATA_URL = '/BilderCHInfra/visualisation_examples/data/data_short.json';
    const GEOM_URL = '/BilderCHInfra/visualisation_examples/data/geom.geojson';
    const OVERLAY_ID = 'network-overlay-svg';
    const MAP_CENTER = [8.3, 46.8];
    const MAP_SCALE = 4000;
    const RADIUS_RATIO = 0.3;
    const DOT_OUT_OFFSET = 6;
    const LANE_SPACING = 8;
    const ITEM_OPACITY_LOW = 0.1;
    const ITEM_OPACITY_MID = 0.5;
    const ITEM_OPACITY_HIGH = 1;
    const LINK_COLOR = '#cdcecfff';
    const RING_COLOR = '#929292ff';

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
            const match = geomData.features.find(f => f.properties.gehoert_zu === n.id);
            n.geometry = match ? match.geometry : n.geometry;

        });
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
                y: cy + r * Math.sin(angle),
                radius: r           };
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
        allOuterNodes.sort((a, b) => {
    const groupA = a.group || '';
    const groupB = b.group || '';
    return groupA.localeCompare(groupB); // Sort alphabetically by group
});
        // ===== ORIENTATION CIRCLE =====
        svg.append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', baseRadius- LANE_SPACING)
            .attr('fill', 'none')
            .attr('stroke', RING_COLOR)
            .attr('stroke-width', 3)
            .attr('stroke-opacity', ITEM_OPACITY_LOW);
        // ===== CONNECTORS =====
        const gLinks = svg.append('g').attr('class', 'ring-links');
        // Visible lines
        const connectors = gLinks.selectAll('line')
            .data(allOuterNodes)
            .enter()
            .append('line')
            .attr('class', d => `connector connector-${d.id}`)
            .attr('x1', d => {
                const dx = d.x - cx;
                const dy = d.y - cy;
                const len = Math.sqrt(dx * dx + dy * dy);
                return d.x + (dx / len) * 6; // extend outward by 6px
            })
            .attr('y1', d => {
                const dx = d.x - cx;
                const dy = d.y - cy;
                const len = Math.sqrt(dx * dx + dy * dy);
                return d.y + (dy / len) * 6; // extend outward by 6px
            })
            .attr('x2', d => d.inner?.proj ? d.inner.proj[0] : d.x)
            .attr('y2', d => d.inner?.proj ? d.inner.proj[1] : d.y)
            .attr('stroke', d => topicColorMap(d.group))
            .style("stroke-linecap", "round")
            .attr('stroke-width', 2)
            .attr('stroke-opacity', ITEM_OPACITY_MID)
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
                console.log(l)
                const source = allOuterNodes.find(n => n.id === l.source);
                const target = allOuterNodes.find(n => n.id === l.target);
                if (!source || !target) return null;
                return {
                    source,
                    target,
                    rSource: Math.hypot(source.x - cx, source.y - cy),
                    rTarget: Math.hypot(target.x - cx, target.y - cy),
                    angle: Math.atan2(target.y - cy, target.x - cx),
                    link_type: l.type || ""
                };
            }).filter(d => d);

            //TODO: Beschriftung (Link_Type) auf Arcs ergänzen

            // Sort outerLinks by the group of the source node (or target node)
outerLinks.sort((a, b) => {
    const groupA = a.source.group || '';
    const groupB = b.source.group || '';
    return groupA.localeCompare(groupB); // Sort alphabetically by group
});
        const gOuterLinks = svg.append('g').attr('class', 'outer-links');
        const arcGroups = gOuterLinks.selectAll('g.arc-group')
            .data(outerLinks)
            .enter()
            .append('g')
            .attr('class', d => `arc-group arc-${d.source.id} arc-${d.target.id}`);
        /*
        const drawArc = d => {
            const laneRadius = Math.min(d.rSource, d.rTarget) - LANE_SPACING;
            //const laneRadius = Math.round(d.rTarget - LANE_SPACING);
            console.log(laneRadius)
            const startAngle = d.source.angle;
            const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
            return arcPath(cx, cy, laneRadius, startAngle, endAngle);
        }; */

        
        // helper for evenly spaced radii
        function assignRadiusLines() {
            const laneRadii = outerLinks.map(d => Math.min(d.rSource, d.rTarget) - LANE_SPACING);
            const minR = Math.min(...laneRadii);
            const maxR = Math.max(...laneRadii);

            return laneRadii.map((_, i) =>
                minR + (i / (laneRadii.length - 1)) * (maxR - minR)
            );
        }
        const spacedRadii = assignRadiusLines();
        const drawArc = (d, i) => {
            const laneRadius = Math.round(spacedRadii[i]);
            const startAngle = d.source.angle;
            const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
            return arcPath(cx, cy, laneRadius, startAngle, endAngle);
        };


// Update outerNodes' radii and positions based on calculated arc radii
// Update outerNodes' radii and positions based on calculated arc radii
outerLinks.forEach((link, i) => {
    const sourceNode = outerNodes.find(n => n.id === link.source.id);
    const targetNode = outerNodes.find(n => n.id === link.target.id);
    const laneRadius = Math.round(spacedRadii[i]); // Use the calculated spaced radii

    if (sourceNode) {
        sourceNode.radius = Math.max(sourceNode.radius, laneRadius);
        sourceNode.x = cx + sourceNode.radius * Math.cos(sourceNode.angle);
        sourceNode.y = cy + sourceNode.radius * Math.sin(sourceNode.angle);
    }

    if (targetNode) {
        targetNode.radius = Math.max(targetNode.radius, laneRadius);
        targetNode.x = cx + targetNode.radius * Math.cos(targetNode.angle);
        targetNode.y = cy + targetNode.radius * Math.sin(targetNode.angle);
    }
});

// Rebind data and update connectors
gLinks.selectAll('line.connector')
    .data(allOuterNodes)
    .join('line') // Ensure the data is re-bound
    .attr('class', d => `connector connector-${d.id}`)
    .attr('x1', d => {
        const dx = d.x - cx;
        const dy = d.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        return d.x + (dx / len) * 6; // extend outward by 6px
    })
    .attr('y1', d => {
        const dx = d.x - cx;
        const dy = d.y - cy;
        const len = Math.sqrt(dx * dx + dy * dy);
        return d.y + (dy / len) * 6; // extend outward by 6px
    })
   .attr('x2', d => {
        if (d.inner?.proj) {
            const dx = d.inner.proj[0] - cx;
            const dy = d.inner.proj[1] - cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const clampedLen = Math.min(len, d.radius); // Clamp to the node's radius
            return cx + (dx / len) * clampedLen;
        }
        return d.x;
    })
    .attr('y2', d => {
        if (d.inner?.proj) {
            const dx = d.inner.proj[0] - cx;
            const dy = d.inner.proj[1] - cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const clampedLen = Math.min(len, d.radius); // Clamp to the node's radius
            return cy + (dy / len) * clampedLen;
        }
        return d.y;
    })
    .attr('stroke', d => topicColorMap(d.group))
    .style("stroke-linecap", "round")
    //.attr('stroke-width', 4)
    .attr('stroke-opacity', ITEM_OPACITY_MID)
    .style('pointer-events', 'none');


        arcGroups.append('path')
            .attr('class', d => `arc-path arc-path-${d.source.id} arc-path-${d.target.id}`)
            .attr('d', drawArc)
            .attr('stroke', '#646464ff')
            .attr('stroke-width', 0.7)
            .attr('stroke-opacity', ITEM_OPACITY_MID)
            .attr('fill', 'none')
            .style('pointer-events', 'auto');
        arcGroups.append('path')
            .attr('class', 'arc-hitbox')
            .attr('d', drawArc)
            .attr('stroke', 'transparent')
            .attr('stroke-width', 10)
            .attr('fill', 'none')
            .style('pointer-events', 'stroke');

            // Add a text element to display the link_type
arcGroups.append('text')
    .attr('class', 'arc-label')
    .attr('x', d => {
        const laneRadius = Math.round(spacedRadii[outerLinks.indexOf(d)]);
        const midAngle = (d.source.angle + Math.atan2(d.target.y - cy, d.target.x - cx)) / 2;
        return cx + laneRadius * Math.cos(midAngle);
    })
    .attr('y', d => {
        const laneRadius = Math.round(spacedRadii[outerLinks.indexOf(d)]);
        const midAngle = (d.source.angle + Math.atan2(d.target.y - cy, d.target.x - cx)) / 2;
        return cy + laneRadius * Math.sin(midAngle);
    })
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#333')
    .attr('opacity', 0) // Initially hidden
    .text(d => d.link_type);
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
            .attr('stroke', d => topicColorMap(d.group))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', ITEM_OPACITY_HIGH)
            .style('stroke-dasharray', '4 2')
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
            .style('stroke-dasharray', '4 2')
            //.style('pointer-events', 'stroke')
            .on('mouseenter', (event, d) => highlightNode(svg, d.id, true))
            .on('mouseleave', (event, d) => highlightNode(svg, d.id, false));

        // ===== OUTER DOTS & LABELS =====
        const gDots = svg.append('g').attr('class', 'outer-dots');
        const centerX = width / 2; // Replace with your actual center
        const centerY = height / 2;

        const labels = gDots.selectAll('.label')
            .data(allOuterNodes)
            .enter()
            .append('g') // group for rect + text
            .attr('class', 'label')
            .attr('transform', d => {
                const dx = d.x - centerX;
                const dy = d.y - centerY;
                const length = Math.sqrt(dx * dx + dy * dy);
                const offset = 10;
                return `translate(${d.x + (dx / length) * offset}, ${d.y + (dy / length) * offset})`;
            });

        // add text
        labels.append('text')
            .attr('font-size', '10px')
            .attr('text-anchor', d => (d.x < centerX ? 'end' : 'start'))
            .attr('dy', '0.35em')
            .attr('opacity', ITEM_OPACITY_MID)
            .text(d => d.name)
        // ===== ARC END RECTANGLES =====
        const addArcRect = (group, pos, angle, laneRadius) => {
            const x = cx + laneRadius * Math.cos(angle) - 3;
            const y = cy + laneRadius * Math.sin(angle) - 3;
            group.append('rect')
                .attr('class', 'arc-end')
                .attr('width', 6)
                .attr('height', 6)
                .attr('fill', topicColorMap(pos[pos === pos.source ? 'source' : 'target'].group))
                .attr('stroke-width', 1)
                .attr('stroke', "white")
                .attr('x', x)
                .attr('y', y)
                .attr('transform', `rotate(${angle * 180 / Math.PI}, ${x + 3}, ${y + 3})`);
        };

        // use same spaced radii for rect placement
        arcGroups.each(function(d, i) {
            const laneRadius = Math.round(spacedRadii[i]);
            addArcRect(d3.select(this), d, d.source.angle, laneRadius);
            addArcRect(d3.select(this), d, Math.atan2(d.target.y - cy, d.target.x - cx), laneRadius);
        });

        // ===== GEOMETRY PATHS =====
        const gGeomPaths = svg.append("g").attr("class", "geom-paths");

        gGeomPaths.selectAll("g.geom-group")
            .data(innerNodes.filter(d => d.geometry))
            .enter()
            .append("g")
            .attr("class", d => `geom-group geom-${d.id}`)
            .each(function(d) {
                const group = d3.select(this);
                let coordinates = [];

                // Check if the geometry is a LINESTRING or MULTILINESTRING
                if (d.geometry.type === "LineString") {
                    coordinates = [d.geometry.coordinates]; // Wrap the coordinates in an array to handle uniformly
                } else if (d.geometry.type === "MultiLineString") {
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
                        .attr("opacity", ITEM_OPACITY_LOW) // invisible until hover
                        .style("pointer-events", "none");
                });
            });


        // ===== HOVER LOGIC =====
        const hoveredNodes = new Set();

        function highlightNode(svg, nodeId, on) {
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
        }
// Arc hover
arcGroups.on('mouseenter', (event, d) => {
    highlightNode(svg, d.source.id, true);
    highlightNode(svg, d.target.id, true);

    // Show the arc label
    d3.select(event.currentTarget).select('.arc-label')
        .transition()
        .duration(200)
        .attr('opacity', 1); // Make the text visible
}).on('mouseleave', (event, d) => {
    highlightNode(svg, d.source.id, false);
    highlightNode(svg, d.target.id, false);

    // Hide the arc label
    d3.select(event.currentTarget).select('.arc-label')
        .transition()
        .duration(200)
        .attr('opacity', 0); // Hide the text
});
        /*
        // Connector hover
        [...connectors.nodes(), ...gNoCoordLinks.selectAll('line').nodes()].forEach(line => {
            d3.select(line)
                .on('mouseenter', (event, d) => {
                    console.log(d)
                    highlightNode(svg, d.id, true);
                    outerLinks.forEach(link => {
                        console.log(link)
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
        */

        // ===== LEGEND BELOW 'THEMA-NODE' =====
        const numThemaNodes = nodes.filter(d => d.group === "thema").length;
        const legendStartY = 55 + numThemaNodes * 20 + 20; // 50=startY, 20=offset, +20 padding

        const legendGroup = svg.append('g')
            .attr('class', 'network-legend')
            .attr('transform', `translate(100, ${legendStartY})`);

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
                .attr('fill', '#333')
                .attr('font-family', 'sans-serif');

            yOffset += 25;
        });
    }

    window.addEventListener('resize', () => {
    const container = document.getElementById('chart');
    if (container) draw(container);
});
   function init() {
    const container = document.getElementById('chart') || document.body;
    if (!container) return;

    // Draw the visualization initially
    draw(container);

    // Add a ResizeObserver to redraw on container size changes
    const resizeObserver = new ResizeObserver(() => {
        draw(container);
    });
    resizeObserver.observe(container);
}
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
