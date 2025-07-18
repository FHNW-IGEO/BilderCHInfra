let isBioFabric = false
// Create chart elements: lines for nodes, link caps, and setup mouse events
function createChart_2() {
    link.transition().delay(1000).duration(1500).attr("stroke-opacity", 0.5) // Show links after delay
    // Add lines to represent the connection between nodes
    const nodeLines = svg.append("g")
        .attr("class", "node_lines")
        .selectAll("line")
        .data(nodes)
        .join("line")
        .attr("stroke-width", 4)
        .attr("stroke", d => {
            // Define color based on node's group and its connection
            if (d.group === "thema") {
                const correspondingNode = nodes.find(node => node.group === d.name && node.group !== "thema");
                if (correspondingNode) {
                    return topicColorMap(correspondingNode.group);
                }
            } else {
                return topicColorMap(d.group);
            }
        })
        .attr("stroke-opacity", 0.6)
        .attr("x1", d => d.x)
        .attr("y1", d => d.y)
        .attr("x2", d => d.x)
        .attr("y2", d => d.y)

    const linkCapsTop = svg.append("g")
        .attr("class", "link-caps-top")
        .selectAll("rect")
        .data(links)
        .join("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#555")
        .attr("rx", 2) // rounded corners
        .attr("ry", 2)
        .attr("opacity", 0);

    // add caps (bottom squares)
    const linkCapsBottom = svg.append("g")
        .attr("class", "link-caps-bottom")
        .selectAll("rect")
        .data(links)
        .join("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#555")
        .attr("rx", 2)
        .attr("ry", 2)
        .attr("opacity", 0);


    // on nodeLines (horizontal lines)
    nodeLines
        .on("mouseover", function(event, d) {
            console.log(nodeLines, link, linkCapsBottom, linkCapsTop)
            // d is the node this horizontal line represents
            nodeLines.classed("dimmed", true);
            link.classed("dimmed", true);
            linkCapsTop.classed("dimmed", true);
            linkCapsBottom.classed("dimmed", true);

            d3.select(this).classed("dimmed", false); // keep this line visible

            // highlight all vertical link lines connected to this node
            link.filter(l => l.source.id === d.id || l.target.id === d.id)
                .classed("dimmed", false);
        })
        .on("mouseout", function() {
            nodeLines.classed("dimmed", false);
            link.classed("dimmed", false);
            linkCapsTop.classed("dimmed", false);
            linkCapsBottom.classed("dimmed", false);
        });

    // on vertical links
    link
        .on("mouseover", function(event, l) {
            nodeLines.classed("dimmed", true);
            link.classed("dimmed", true);
            linkCapsTop.classed("dimmed", true);
            linkCapsBottom.classed("dimmed", true);

            d3.select(this).classed("dimmed", false); // keep this vertical line visible

            // highlight the horizontal lines corresponding to source and target nodes
            nodeLines.filter(n => n.id === l.source.id || n.id === l.target.id)
                .classed("dimmed", false);

        })
        .on("mouseout", function() {
            nodeLines.classed("dimmed", false);
            link.classed("dimmed", false);
            linkCapsTop.classed("dimmed", false);
            linkCapsBottom.classed("dimmed", false);
        });

    return {
        svg,
        link,
        node,
        nodeLines,
        nodes,
        links,
        linkCapsTop,
        linkCapsBottom
    };
}



// Start the animation for node and link transitions
function startAnimation_2() {
    if (isAnimating) return; // Prevent re-triggering if animation is already in progress
    isAnimating = true;

    document.getElementById('startBtn2').disabled = true; // Disable start button
    document.getElementById('resetBtn').disabled = false; // Enable reset button

    // Create chart elements (node lines, links, caps)
    const {
        svg,
        link,
        nodeLines,
        nodes,
        linkCapsTop,
        linkCapsBottom
    } = createChart_2();

    // Transition map layer and text (fade out)
    svg.selectAll(".map-layer").transition().duration(1000).style("opacity", 0);
    svg.selectAll("text").transition().duration(1000).style("opacity", 0).remove();


    // Set timing durations for the animation steps
    const duration = 2000;
    const duration1 = 3000;
    const duration2 = 3500;
    const duration3 = 4000;
    const duration4 = 4500;
    const duration5 = 5000;

    // Define transitions with delay and durations for smooth animations
    const t1 = svg.transition().delay(duration).duration(duration1);
    const t2 = svg.transition().delay(duration + duration1).duration(duration2);
    const t3 = svg.transition().delay(duration + duration1 + duration2).duration(duration3);

    const node = svg.selectAll("circle");

    // Node radius animation (shrinking effect)
    node.transition(t1).ease(d3.easeCubicOut).attr("r", 4);
    // Node vertical positioning (to align with rows)
    node.transition(t2).attr("cy", d => y(d.row));

    // Update the node lines to stretch across the width of the chart
    nodeLines.transition(t1)
        .attr("x1", margin.left)
        .attr("y1", d => d.y)
        .attr("x2", width - margin.right)
        .attr("y2", d => d.y);

    // Node opacity transition (fading out nodes)
    node.transition(t3)
        .ease(d3.easeCubicOut)
        .style("opacity", 0);

    // Node lines vertical alignment after transition
    nodeLines.transition(t2)
        .attr("y1", d => y(d.row))
        .attr("y2", d => y(d.row));

    // Link positioning and stroke width transitions
    link.transition(t2)
        .attr("y1", d => y(d.source.row))
        .attr("y2", d => y(d.target.row));

    link.transition(t3)
        .attr("stroke-width", 2)
        .attr("x1", d => x(d.index))
        .attr("x2", d => x(d.index));

    // Further node line adjustments based on column range
    nodeLines.transition()
        .delay(duration + duration1 + duration2 + duration3)
        .duration(duration5)
        .attr("x1", d => x(d.minCol))
        .attr("x2", d => x(d.maxCol));

    // Link cap transitions for visual endpoint animation
    linkCapsTop.transition(t3)
        .attr("x", d => x(d.index) - 4)
        .attr("y", d => y(d.source.row) - 4);

    linkCapsBottom.transition(t3)
        .attr("x", d => x(d.index) - 4)
        .attr("y", d => y(d.target.row) - 4);

    // Set link cap opacity after transitions
    linkCapsTop.transition()
        .delay(duration + duration1 + duration2 + duration3)
        .attr("opacity", 1);

    linkCapsBottom.transition()
        .delay(duration + duration1 + duration2 + duration3)
        .attr("opacity", 1);

    // Create and animate labels for nodes
    const labels = svg.append("g")
        .attr("class", "labels")
        .attr("font-size", 12)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("font-family", "sans-serif")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text(d => d.id)
        .attr("x", 0)
        .attr("y", d => y(d.row))
        .attr("stroke-width", 2)
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .style("font-weight", d => d.group === "thema" ? "bold" : "normal")
        .style("text-decoration", d => d.group === "thema" ? "underline" : "none");

    // Clone labels for visible and styled text (non-stroked)
    labels.clone(true)
        .attr("stroke", "none")
        .attr("fill", "black");

    // Animate labels' horizontal movement
    svg.selectAll(".labels text")
        .transition()
        .delay(duration1 + duration2 + duration3 + duration4)
        .duration(duration5)
        .attr("x", d => x(d.minCol) - 5);

    // Mark the animation as completed after all transitions
    setTimeout(() => {
        isAnimating = false;
    }, duration1 + duration2 + duration3 + duration4 + duration5);

    isBioFabric = true
}

// Reset the visualization (re-fetch data and re-draw)
function resetVisualization() {
    if (isAnimating) return; // Prevent reset if animation is ongoing

    // Clear existing chart elements
    d3.select("#chart").selectAll("*").remove();

    // Fetch and redraw the network
    fetch('kraftwerke.json')
        .then(response => response.json())
        .then(json => {
            sampleData = json;
            data = JSON.parse(JSON.stringify(sampleData));
            drawNetwork();
        })
        .catch(error => console.error('Error loading JSON:', error));

    // Enable and disable appropriate buttons
    document.getElementById('startBtn2').disabled = false;
    document.getElementById('resetBtn').disabled = true;
    isBioFabric = false
}

function activateTime() {
    const timeslider = document.getElementById("timeBtn");
    const sliderContainer = document.getElementById('timecontainer');
    sliderContainer.style.display = 'block'; // Show slider container when activated

    // Initialize slider if not already initialized
    if (!$("#slider-range").hasClass("ui-slider")) {
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

            // Debounced update for slider
            const debouncedUpdate = debounce(updateNodeStyles, 10);

            // Initialize the slider with range and values
            $("#slider-range").slider({
                range: true,
                min: minYear, // Dynamic min value from the data
                max: new Date().getFullYear(),
                values: [minYear, new Date().getFullYear()],
                slide: function(event, ui) {
                    // Update the displayed values above the slider
                    $("#minValue").text(ui.values[0]);
                    $("#maxValue").text(ui.values[1]);

                    // Position the minValue and maxValue based on the handle positions
                    const minHandlePos = $(".ui-slider-handle:first").position().left;
                    const maxHandlePos = $(".ui-slider-handle:last").position().left;

                    $("#minValue").css("left", minHandlePos - $("#minValue").outerWidth() / 2);
                    $("#maxValue").css("left", maxHandlePos - $("#maxValue").outerWidth() / 2);

                    debouncedUpdate(ui.values[0], ui.values[1]);
                }
            });

            // Set initial text for the slider values
            $("#minValue").text(minYear);
            $("#maxValue").text(new Date().getFullYear());

            // Manually update the position of minValue and maxValue after initialization
            setSliderValuePositions();

        });
    }


    // Toggle the slider's visibility when the button is clicked (on/off)
    timeslider.addEventListener("click", function() {
        if (sliderContainer.style.display === 'block') {
            // Hide slider and reset when it's currently visible
            sliderContainer.style.display = 'none';
            d3.selectAll("circle").style("opacity", 1).style("filter", "none");
        } else {
            // Show slider when it's currently hidden
            sliderContainer.style.display = 'block';
            const minVal = $("#slider-range").slider("values", 0);
            const maxVal = $("#slider-range").slider("values", 1);
            updateNodeStyles(minVal, maxVal);
        }
    });

}

// Function to set the position of the minValue and maxValue labels
function setSliderValuePositions() {
    const minHandlePos = $(".ui-slider-handle:first").position().left;
    const maxHandlePos = $(".ui-slider-handle:last").position().left;

    $("#minValue").css("left", minHandlePos - $("#minValue").outerWidth() / 2);
    $("#maxValue").css("left", maxHandlePos - $("#maxValue").outerWidth() / 2);
}


function updateNodeStyles(minVal, maxVal) {
    if (!isBioFabric){
        const currentYear = new Date().getFullYear(); // Get the current year
        const affectedNodes = new Set();

        d3.selectAll("circle").each(function(d) {
            // If "Aktiv", set `bis` to current year
            if (d.bis === "Aktiv") {
                d.bis = currentYear;
            }

            let nodeChanged = false;
            // Update node styles based on `minVal` and `maxVal`
            if (d.von >= minVal && d.bis <= maxVal) {
                d3.select(this).style("opacity", 1).style("filter", "none");
            } else if (minVal <= d.von && maxVal <= d.bis) {
                d3.select(this).style("opacity", 0.5).style("filter", "none");
                nodeChanged = true;
            } else if (minVal >= d.von && maxVal >= d.bis) {
                d3.select(this).style("opacity", 1).style("filter", "grayscale(100%)");
                nodeChanged = true;
            } else {
                d3.select(this).style("opacity", 1).style("filter", "none");
            }

            if (nodeChanged) {
                affectedNodes.add(d.id);
            }
        });

        // Adjust link opacity based on affected nodes
        d3.selectAll("line").each(function() {
            const link = d3.select(this).datum();
            if (link?.source?.id && link?.target?.id) {
                if (affectedNodes.has(link.source.id) || affectedNodes.has(link.target.id)) {
                    d3.select(this).style("opacity", 0.1);
                } else {
                    d3.select(this).style("opacity", 1);
                }
            }
        });
        
        // Update link cap opacity based on affected nodes
        d3.selectAll("rect").each(function() {
            const rect = d3.select(this).datum(); // Get data associated with each rectangle
            if (rect?.source?.id && rect?.target?.id) {
                // If the source or target node of the link is affected, adjust the opacity
                if (affectedNodes.has(rect.source.id) || affectedNodes.has(rect.target.id)) {
                    d3.select(this).style("opacity", 0.1); // Decrease opacity if outside range
                } else {
                    d3.select(this).style("opacity", 1); // Keep full opacity if within range
                }
            }
        });

    } else {
            link.attr("stroke-opacity", 1)
        const currentYear = new Date().getFullYear(); // Get the current year
        const affectedNodes = new Set();

        // Loop through each line (link) and update its style based on the slider range
        d3.selectAll("line").each(function(d) {
            // If "Aktiv", set `bis` to current year
            if (d.bis === "Aktiv") {
                d.bis = currentYear;
            }

            let nodeChanged = false;
            // Update link styles based on `minVal` and `maxVal`
            if (d.von >= minVal && d.bis <= maxVal) {
                d3.select(this).style("opacity", 1).style("filter", "none");
            } else if (minVal <= d.von && maxVal <= d.bis) {
                d3.select(this).style("opacity", 0.2).style("filter", "none");
                nodeChanged = true;
            } else if (minVal >= d.von && maxVal >= d.bis) {
                d3.select(this).style("opacity", 1).style("filter", "grayscale(100%)");
                nodeChanged = true;
            } else {
                d3.select(this).style("opacity", 1).style("filter", "none");
            }

            if (nodeChanged) {
                affectedNodes.add(d.id);
            }
        });

        // Adjust link opacity based on affected nodes
        d3.selectAll("line, rect").each(function() {
            const link = d3.select(this).datum(); // Safely get the bound data
            if (link?.source?.id && link?.target?.id) {
                if (affectedNodes.has(link.source.id) || affectedNodes.has(link.target.id)) {
                    d3.select(this).style("opacity", 0.1); // Reduce opacity for affected links
                } else {
                    d3.select(this).style("opacity", 1); // Keep full opacity for unaffected links
                }
            }
        });
    }
}

// Add event listeners for start and reset buttons
document.getElementById('startBtn2').addEventListener('click', startAnimation_2);
document.getElementById('resetBtn').addEventListener('click', resetVisualization);
document.addEventListener('DOMContentLoaded', resetVisualization);
