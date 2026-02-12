import {
    parseCoords,
    createOverlaySVG,
    arcPath,
    assignRadiusLines,
    getActiveThema,
    setActiveThema,
    descriptiveLegend,
    hoverClick,
    hoverMouseEnter,
    hoverMouseLeave,
    getArcClassFromElement,
    getConnectorClassFromElement
} from './functions.js';
import {
    drawNetwork
} from './map.js'

const DATA_URL = '/BilderCHInfra/visualisation_examples/data/Nationalstrassen_Hochspannung.json';
const GEOM_URL = '/BilderCHInfra/visualisation_examples/data/geom.geojson';
const OVERLAY_ID = 'network-overlay-svg';
const MAP_CENTER = [8.311026555744672, 47.33633643561324];
const MAP_SCALE = 9000;
const RADIUS_RATIO = 0.5;
const DOT_OUT_OFFSET = 1;
const LANE_SPACING = 7;
const ITEM_OPACITY_LOW = 0.1;
const ITEM_OPACITY_MID = 0.5;
const ITEM_OPACITY_HIGH = 1;


(function() {
    async function draw(container) {
        const overlay = createOverlaySVG(container, OVERLAY_ID);
        if (!overlay) return;
        const {
            svg,
            width,
            height
        } = overlay;
        const cx = width / 2;
        const cy = height / 2;
        const baseRadius = Math.min(cx, cy) * RADIUS_RATIO;

        const projection = d3.geoMercator()
            .center(MAP_CENTER)
            .scale(MAP_SCALE)
            .translate([cx, cy]);

        const geoPathGenerator = d3.geoPath().projection(projection);

        svg.selectAll("path").attr("d", geoPathGenerator);
        let sampleData;
        try {
            const resp = await fetch(DATA_URL);
            sampleData = await resp.json();
        } catch (e) {
            console.error('Failed to load data', e);
            return;
        }
        const nodesRaw = sampleData.nodes || [];

        svg.append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', baseRadius + DOT_OUT_OFFSET - LANE_SPACING / 2)
            .attr('fill', 'none')
            .attr('stroke', 'grey')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', ITEM_OPACITY_LOW);
        // Merge geometry into nodes before any filtering
        //nodesRaw.forEach(n => {
        //    const match = geomData.features.find(f => f.properties.gehoert_zu === n.id);
        //    n.geometry = match ? match.geometry : n.geometry;
        //});

        const mapNodes = nodesRaw
            .filter(n => n.group !== 'thema')
            .map(n => {
                const proj = parseCoords(n.koordinaten) ? projection(parseCoords(n.koordinaten)) : null;
                return {
                    ...n,
                    proj
                };
            })
            .filter(n => n.proj);

        const networkNodes = mapNodes.map((n, i) => {
            const dx = n.proj[0] - cx;
            const dy = n.proj[1] - cy;
            const angle = Math.atan2(dy, dx);
            const r = baseRadius + i * LANE_SPACING;
            return {
                id: n.id,
                name: n.name,
                group: n.group,
                angle,
                inner: n,
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle),
                radius: r
            };
        });

        const outerNoCoordsNodes = nodesRaw
            .filter(n => n.koordinaten === null)
            .map((n, i) => {
                const r = baseRadius + (mapNodes.length + i) * LANE_SPACING;
                const angle = (i * 2 * Math.PI) / nodesRaw.length;
                return {
                    ...n,
                    angle,
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                };
            });

        const allNetworkNodes = networkNodes.concat(outerNoCoordsNodes);

        //allNetworkNodes.sort((a, b) => {
        //    const groupA = a.group || '';
        //    const groupB = b.group || '';
        //    return groupA.localeCompare(groupB); // Sort alphabetically by group
        //});

        // ===== CONNECTORS =====
        const gLinks = svg.append('g').attr('class', 'ring-links');
        // Visible lines
        // Define topicColorMap in network_overlay.js
        const topicColorMap = d3.scaleOrdinal()
            .domain([...new Set(nodesRaw.map(d => d.group))]) // Replace `allOuterNodes` with the appropriate data
            .range(d3.schemeTableau10);

        // Hitboxes
        gLinks.selectAll('.connector-hitbox')
            .data(allNetworkNodes)
            .enter()
            .append('line')
            .attr('class', d => `connector-hitbox connector-hitbox-${d.id}`)
            .attr('data-connector-class', d => `connector-group connector-${d.id}`)
            .attr('x1', d => d.x)
            .attr('y1', d => d.y)
            .attr('x2', d => d.inner?.proj ? d.inner.proj[0] : d.x)
            .attr('y2', d => d.inner?.proj ? d.inner.proj[1] : d.y)
            .attr('stroke', 'transparent')
            .attr('stroke-width', 10)
            .attr('fill', 'black')
            .style('pointer-events', 'stroke')


        gLinks.selectAll('.connector-hitbox')
            .on('mouseenter', function(event, d) {
                const activeThema = getActiveThema();
                console.log(activeThema)
                if (activeThema) {
                    temp = svg.selectAll(`.connector-${d.id}`).filter(d => {console.log(d); return null})//d.group === getActiveThema()})
                        //.attr('stroke-width', 3)
                        .attr('stroke-opacity', ITEM_OPACITY_HIGH)
                        console.log(temp)

                } else {
                    console.log("ola")
                    // Highlight the corresponding connector line
                    svg.selectAll(`.connector-${d.id}`)
                        .attr('stroke-width', 3)
                        .attr('stroke-opacity', ITEM_OPACITY_HIGH);

                    svg.selectAll(`.text-label-${d.id} text`)
                        .attr('opacity', 1)

                }
            })
            .on('mouseleave', function(event, d) {
                 const activeThema = getActiveThema();
                 if (activeThema) {
                // Reset connector
                svg.selectAll(`.connector-${d.id}`)
                  .attr('stroke-width', 1)
                 .attr('stroke-opacity', ITEM_OPACITY_MID);

                // Reset label
                svg.selectAll(`.text-label-${d.id} text`)
                    .attr('opacity', 1)
                 }
                 else{
                    // Reset connector
                svg.selectAll(`.connector-${d.id}`)
                  .attr('stroke-width', 1)
                 .attr('stroke-opacity', ITEM_OPACITY_MID);

                // Reset label
                svg.selectAll(`.text-label-${d.id} text`)
                    .attr('opacity', 1)


                 }
            });


        // ===== OUTER RELATIONSHIPS (INNER LANE ARCS) =====
        const outerLinks = (sampleData.links || [])
            .map(l => {
                const source = allNetworkNodes.find(n => n.id === l.source);
                const target = allNetworkNodes.find(n => n.id === l.target);
                if (!source || !target) return null;
                return {
                    source,
                    target,
                    rSource: Math.hypot(source.x - cx, source.y - cy),
                    rTarget: Math.hypot(target.x - cx, target.y - cy),
                    angle: Math.atan2(target.y - cy, target.x - cx),
                    link_type: l.type || "",
                    geometry: l.geometry || null
                };
            }).filter(d => d);

        // Sort outerLinks by the group of the source node (or target node)
        //outerLinks.sort((a, b) => {
        //    const groupA = a.source.group || '';
        //    const groupB = b.source.group || '';
        //    return groupA.localeCompare(groupB); // Sort alphabetically by group
        //});
        const gOuterLinks = svg.append('g').attr('class', 'outer-links');
        const arcGroups = gOuterLinks.selectAll('g.arc-group')
            .data(outerLinks)
            .enter()
            .append('g')
            .attr('class', d => `arc-group arc-${d.source.id} arc-${d.target.id}`)
            .attr('data-arc-class', d => `arc-${d.source.id}-${d.target.id}`);


        const spacedRadii = assignRadiusLines(outerLinks, LANE_SPACING);
        const drawArc = (d, i) => {
            const laneRadius = Math.round(spacedRadii[i]);
            const startAngle = d.source.angle;
            const endAngle = Math.atan2(d.target.y - cy, d.target.x - cx);
            return arcPath(cx, cy, laneRadius, startAngle, endAngle);
        };

        // Update outerNodes' radii and positions based on calculated arc radii
        outerLinks.forEach((link, i) => {
            const sourceNode = networkNodes.find(n => n.id === link.source.id);
            const targetNode = networkNodes.find(n => n.id === link.target.id);
            const laneRadius = Math.round(spacedRadii[i]); // Use the calculated spaced radii
            //
            if (sourceNode) {
                sourceNode.radius = Math.max(sourceNode.radius, laneRadius);
                sourceNode.x = cx + sourceNode.radius * Math.cos(sourceNode.angle);
                sourceNode.y = cy + sourceNode.radius * Math.sin(sourceNode.angle);
            }
            //
            if (targetNode) {
                targetNode.radius = Math.max(targetNode.radius, laneRadius);
                targetNode.x = cx + targetNode.radius * Math.cos(targetNode.angle);
                targetNode.y = cy + targetNode.radius * Math.sin(targetNode.angle);
            }
        });

        console.log(allNetworkNodes)
        // Rebind data and update connectors
        gLinks.selectAll('line.connector')
            .data(allNetworkNodes)
            .join('line') // Ensure the data is re-bound
            .attr('class', d => `connector connector-${d.id}`)
            .attr('x1', d => {
                return d.x
            })
            .attr('y1', d => {
                return d.y
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
            .attr('stroke-opacity', ITEM_OPACITY_MID)
            .style('pointer-events', 'none');

        arcGroups.append('path')
            .attr('class', d => `arc-path arc-path-${d.source.id} arc-path-${d.target.id} arc-${d.source.id}-${d.target.id}`)
            .attr('data-arc-class', d => `arc-${d.source.id}-${d.target.id}`)
            .attr('id', (d, i) => `arc-path-${i}`) // Assign a unique ID to each path
            .attr('d', drawArc)
            .attr('stroke', '#646464ff')
            .attr('data-default-stroke', '#646464ff')
            .attr('stroke-width', 0.7)
            .attr('data-default-width', 0.7)
            .attr('stroke-opacity', ITEM_OPACITY_MID)
            .attr('fill', 'none')
            .style('pointer-events', 'auto');

        arcGroups.append('path')
            .attr('class', 'arc-hitbox')
            .attr('data-arc-class', d => `arc-${d.source.id}-${d.target.id}`)
            .attr('d', drawArc)
            .attr('stroke', 'transparent')
            .attr('stroke-width', 10)
            .attr('fill', 'none')
            .style('pointer-events', 'stroke');

        // Add a text element to display the link_type
        arcGroups.append('text')
            .attr('class', 'arc-label')
            .attr('text-anchor', 'middle') // Center the text along the path
            .attr('font-size', '10px')
            .attr('fill', 'black')
            .attr('opacity', 0) // Initially hidden
            .append('textPath')
            .attr('xlink:href', (d, i) => `#arc-path-${i}`) // Reference the arc path by ID
            .attr('startOffset', '50%') // Position the text in the middle of the path
            .attr('alignment-baseline', 'after-edge')
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

        // ===== OUTER DOTS & LABELS =====
        const gDots = svg.append('g').attr('class', 'outer-dots');

        const labels = gDots.selectAll('.label')
            .data(allNetworkNodes)
            .enter()
            .append('g') // group for rect + text

            .attr("class", d => `label text-label-${d.id}`)
            .attr('transform', d => {
                const dx = d.x - cx;
                const dy = d.y - cy;
                const length = Math.sqrt(dx * dx + dy * dy);
                const offset = 10;
                return `translate(${d.x + (dx / length) * offset}, ${d.y + (dy / length) * offset})`;
            });

        // add text
        labels.append('text')
            .datum(d => d)
            .attr('font-size', '10px')
            .attr('text-anchor', d => (d.x < cx ? 'end' : 'start'))
            .attr('dy', '0.35em')
            .attr('opacity', 1)
            .text(d => d.name)

        // ===== ARC END RECTANGLES =====
        const addArcRect = (group, pos, angle, laneRadius) => {
            const x = cx + laneRadius * Math.cos(angle) - 3;
            const y = cy + laneRadius * Math.sin(angle) - 3;
            group.append('rect')
                .attr('class', 'arc-end')
                .attr('data-arc-class', `arc-${pos.source.id}-${pos.target.id}`)
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
        drawGeometry();

        // Keep track of selected elements (shared between connectors and arcs)
        const selectedElements = new Set();
        // ===== Hovering logic ===== 
        hoverMouseEnter(arcGroups, svg, getArcClassFromElement, getConnectorClassFromElement, selectedElements, ITEM_OPACITY_LOW, ITEM_OPACITY_MID, ITEM_OPACITY_HIGH);
        hoverMouseLeave(arcGroups, svg, getArcClassFromElement, getConnectorClassFromElement, selectedElements, ITEM_OPACITY_LOW, ITEM_OPACITY_MID, ITEM_OPACITY_HIGH);
        hoverClick.call(this, arcGroups, selectedElements, ITEM_OPACITY_LOW, ITEM_OPACITY_MID, ITEM_OPACITY_HIGH);
        // Use reset button provided in HTML and attach reset handler
        const resetButton = d3.select('#reset-button');

        function drawGeometry() {
            const gGeomPaths = svg.append("g").attr("class", "geom-paths");

            gGeomPaths.selectAll("g.geom-group")
                .data(mapNodes.filter(d => d.geometry))
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
                            .attr('stroke', d => topicColorMap(d.group))
                            .attr("stroke-width", 0.7)
                            .attr("opacity", ITEM_OPACITY_MID) // invisible until hover
                            .style("pointer-events", "none");
                    });
                });

            // ===== LINK GEOMETRY PATHS =====
            const gLinkGeomPaths = svg.append("g").attr("class", "link-geom-paths");
            // Render link geometries
            gLinkGeomPaths.selectAll("g.link-geom-group")
                .data(outerLinks.filter(d => d.geometry)) // Filter links with geometry
                .enter()
                .append("g")
                .attr("class", d => `link-geom-group link-geom-${d.source.id}-${d.target.id}`)
                .each(function(d) {
                    const group = d3.select(this);
                    const coordinates = d.geometry.type === "LineString" ? [d.geometry.coordinates] : d.geometry.coordinates;

                    coordinates.forEach(line => {
                        const pathData = line.map(coord => {
                            if (!Array.isArray(coord) || coord.length < 2) return null;
                            const [lon, lat] = coord; // Assuming coordinates are [longitude, latitude]
                            const [x, y] = projection([lon, lat]); // Project the coordinates
                            return `${x},${y}`;
                        }).filter(Boolean).join("L");

                        if (!pathData) return;

                        const pathString = `M${pathData}`;

                        group.append("path")
                            .attr("d", pathString)
                            .attr("fill", "none")
                            .attr('stroke', d => topicColorMap(d.source.group))
                            .attr("stroke-width", 0.7)
                            .attr("opacity", ITEM_OPACITY_MID) // Initially hidden
                            .style("pointer-events", "none");
                    });


                });
        }

        function resetSelection() {
            const container = document.getElementById('chart') || document.body;
            if (!container) return;
            setActiveThema(null);
            // Redraw both overlay and main network
            drawNetwork(sampleData, SWISSMAP, MAP_CENTER, MAP_SCALE, RADIUS_RATIO)
            draw(container);

            // Clear selection set
            selectedElements.clear();
        }
        resetButton.on('click', resetSelection);

        // ===== LEGEND BELOW 'THEMA-NODE' =====
        descriptiveLegend(nodesRaw, svg);
    }


    function init() {
        const container = document.getElementById('chart') || document.body;
        if (!container) return;

        let mapData = {};
        let data;

        fetch(DATA_URL)
            .then(response => response.json())
            .then(json => {
                mapData = json; // Save the fetched data
                data = JSON.parse(JSON.stringify(mapData)); // Deep copy

                // Now that data is available, draw the network
                drawNetwork(data, SWISSMAP, MAP_CENTER, MAP_SCALE, RADIUS_RATIO);
                draw(container);

                // Add ResizeObserver after initial draw
                const resizeObserver = new ResizeObserver(() => {
                    draw(container);
                });
                resizeObserver.observe(container);
            })
            .catch(error => console.error('Error loading JSON:', error)); // Handle errors
    }

    window.addEventListener('resize', () => {
        const container = document.getElementById('chart');
        if (container) {
            draw(container)
        } else {
            return null
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
