// Create chart elements: lines for nodes, link caps, and setup mouse events
function createChart_2() {
        link.transition().delay(1000).duration(1500).attr("stroke-opacity", 1)  // Show links after delay
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

        return {svg, link, node, nodeLines, nodes, links, linkCapsTop, linkCapsBottom};
    }



// Start the animation for node and link transitions
function startAnimation_2() {
    if (isAnimating) return;  // Prevent re-triggering if animation is already in progress
    isAnimating = true;

    document.getElementById('startBtn2').disabled = true;  // Disable start button
    document.getElementById('resetBtn').disabled = false;  // Enable reset button

    // Create chart elements (node lines, links, caps)
    const { svg, link, nodeLines, nodes, linkCapsTop, linkCapsBottom} = createChart_2();

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
}

// Add event listeners for start and reset buttons
document.getElementById('startBtn2').addEventListener('click', startAnimation_2);
document.getElementById('resetBtn').addEventListener('click', resetVisualization);
document.addEventListener('DOMContentLoaded', resetVisualization);
