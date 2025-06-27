import drag from "./helperfunctions/drag.js";
import computeCentering from "./helperfunctions/computeCentering.js";
import updateNodeStyles from "./helperfunctions/updateNodeStyles.js";
import ticked from "./helperfunctions/ticked.js";
import moveToMapCoordinates from "./views/map.js";
import resetToInitialPositions from "./views/network.js";
import transformToCirclePack from "./views/circlepack.js";

Promise.all([
    d3.json("scripts/data/nodes.json"),
    d3.json("scripts/data/links.json"),
    d3.json("scripts/data/switzerland.geojson"),
    d3.json("scripts/data/geom.geojson"),
]).then(([nodes, links, switzerland, geom]) => {
    // Merge geom geometry attribute to nodes based on gehoert_zu attribute
    nodes.forEach(node => {
        const matchingGeom = geom.features.find(feature => feature.properties.gehoert_zu === node.id);
        node.geometry = matchingGeom ? matchingGeom.geometry : null;
    });

    const svg = d3.select("svg");
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    svg.attr("width", width).attr("height", height);
    svg.attr("preserveAspectRatio", "xMidYMid meet").attr("viewBox", `0 0 ${width} ${height}`);
    
    let initialPositions = {};
    // Extract unique groups (topics)
    const groups = Array.from(new Set(nodes.map(d => d.group)));
    // Define a color scale
    const colorScale = d3.scaleOrdinal().domain(groups).range(d3.schemeTableau10); // or any other categorical color scheme
    // Map to store base (thema) colors
    const topicColorMap = {};
    const themaNodes = groups.map(group => {
        const baseColor = d3.color(colorScale(group));
        topicColorMap[group] = baseColor;
        return {
            id: group,
            group: "thema",
            color: baseColor.formatHex()
        };
    });

    // Assign lighter colors to normal nodes based on their group
    nodes.forEach(d => {
        if (d.group !== "thema") {
            const base = topicColorMap[d.group];
            if (base) {
                const lighter = base.brighter(1);
                d.color = lighter.formatHex();
            }
        }
    });
    // Add the thema nodes to the main node list
    nodes = nodes.concat(themaNodes);

    // _________________________
    // TimeSlider initialization
    // _________________________
    $(function() {
        const minYear = d3.min(nodes, d => {
            const year = parseInt(d.von);
            return isNaN(year) ? Infinity : year;
        });

        const debounce = (func, wait) => {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };
        const debouncedUpdate = debounce(updateNodeStyles, 10);
        $("#slider-range").slider({
            range: true,
            min: 1930,
            max: 2025,
            values: [1930, 2025],
            slide: function(event, ui) {
                $("#minValue").text(ui.values[0]);
                $("#maxValue").text(ui.values[1]);
                debouncedUpdate(ui.values[0], ui.values[1]);
            }
        });

        // Set initial text
        $("#minValue").text($("#slider-range").slider("values", 0));
        $("#maxValue").text($("#slider-range").slider("values", 1));
        $("#minValue").text(minYear);
        $("#maxValue").text(2025);
    });

    const timeslider = document.getElementById("timeTravelCheckbox");
    const sliderContainer = document.getElementById('timecontainer');

    timeslider.addEventListener("change", function() {
        if (!timeslider.checked) {
            sliderContainer.style.display = 'none';
            // Show all nodes when checkbox is unchecked
            d3.selectAll("circle").style("opacity", 1).style("filter", "none");
        } else {
            sliderContainer.style.display = 'block';
            // Get current slider values and update node styles
            const minVal = $("#slider-range").slider("values", 0);
            const maxVal = $("#slider-range").slider("values", 1);
            updateNodeStyles(minVal, maxVal);
        }
    });

    // _________________________
    // SwitzerlandMap initialization
    // _________________________
    const {projection, geoPathGenerator} = computeCentering(switzerland.features, 8000, width, height);
    const mapLayer = svg.append("g").attr("class", "map");

    mapLayer.selectAll("path")
        .data(switzerland.features)
        .enter()
        .append("path")
        .attr("d", geoPathGenerator)
        .attr("fill", "#e0e0e0")
        .attr("stroke", "#999");
    mapLayer.style("opacity", 0);

    // Force simulation setup
    const link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("class", "link")
        .attr("stroke-width", 2)
        .attr("stroke", "#999");

    const nodeGroup = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")

    // _________________________
    // TimeSlider initialization
    // _________________________
    nodeGroup.append("circle")
        .attr("r", d => d.group === "thema" ? 15 : 10)
        .attr("fill", d => d.thema && topicColorMap[d.thema] ? topicColorMap[d.thema] : d.color);

    let isCirclePackActive = false;
    let selectedNode = null;
    nodeGroup.on("mouseover", function() {
            d3.select(this).select("text").style("opacity", 1);
        })
        .on("mouseout", function() {
            d3.select(this).select("text").style("opacity", 0);
        });

    // _________________________
    // Select Node/Link initialization
    // _________________________
    nodeGroup.on("click", function(event, d) {
        nodeGroup.select("circle")
            .style("stroke", null)
            .style("stroke-width", null);
        if (!isCirclePackActive) {
            d3.selectAll(".link")
                .style("stroke", "#999")
                .style("stroke-width", 2)
                .style("opacity", 1);
        }
        if (selectedNode === d) {
            selectedNode = null;
        } else {
            d3.select(this).select("circle")
                .style("stroke", "yellow")
                .style("stroke-width", 4);
            selectedNode = d;
            if (!isCirclePackActive) {
                d3.selectAll(".link")
                    .style("opacity", link => {return (link.source.id === d.id || link.target.id === d.id) ? 1 : 0.2;})
                    .style("stroke", link => {return (link.source.id === d.id || link.target.id === d.id) ? "yellow" : "#999";})
                    .style("stroke-width", link => {return (link.source.id === d.id || link.target.id === d.id) ? 3 : 2;});
            }
        }
        event.stopPropagation();
    });

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-50))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .on("tick", function() {ticked(link, nodeGroup, width, height);})
        .on("end", () => {nodes.forEach(d => {
                initialPositions[d.id] = {x: d.x, y: d.y};
            });
        });

    nodeGroup.call(drag(simulation));
    nodeGroup.attr("transform", d => {
        const pos = initialPositions[d.id] || {x: d.x, y: d.y};
        return `translate(${pos.x},${pos.y})`;
    });

    // _________________________
    // MapLegend initialization
    // _________________________
    nodeGroup.append("text")
        .attr("dx", d => d.group === "thema" ? 20 : 12)
        .attr("dy", ".35em")
        .text(d => d.id)
        .style("opacity", 0);

    const legendX = 20;
    const legendY = 60;
    const legendBox = svg.append("rect")
        .attr("class", "legend-box")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", 200)
        .attr("height", 200)
        .attr("fill-opacity", "0")
        .attr("stroke", "#ccc")
        .style("opacity", 0);

    // ____________________________
    // Aufrufen der einzelnen Views
    // ____________________________
    d3.select("#slider").on("input", function() {
        const value = +this.value;
        const label = document.getElementById("mainModeLabel");
        const descriptionBox = document.getElementById("descriptionBox");
        if (value === 0) {
            resetToInitialPositions(nodeGroup, initialPositions, legendBox, mapLayer, link, simulation, svg, selectedNode);
            label.textContent = "Netzwerk";
            isCirclePackActive = false
            descriptionBox.textContent = "Visualisierung des Netzwerks von Infrastrukturen basierend auf Verbindungen.";
        } else if (value === 50) {
            moveToMapCoordinates(nodeGroup, link, mapLayer, legendBox, projection, legendX, legendY, simulation, svg, topicColorMap);
            label.textContent = "Karte";
            isCirclePackActive = true
            descriptionBox.textContent = "Geografische Darstellung der Infrastrukturen auf der Karte der Schweiz.";
        } else if (value === 100) {
            transformToCirclePack(nodes, svg, nodeGroup, mapLayer, legendBox, link, projection);
            label.textContent = "Bubble";
            isCirclePackActive = true
            descriptionBox.textContent = "Clustering der Infrastrukturen nach Themen in einer Bubble-Darstellung.";
        } else {
            label.textContent = "Modus in Transition";
            descriptionBox.textContent = "Eine Zwischenansicht – bitte schieben Sie den Regler auf einen festen Punkt.";
        }
    });
}).catch(error => console.error(error));