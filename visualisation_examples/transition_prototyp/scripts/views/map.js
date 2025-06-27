import * as nodeHover from "../helperfunctions/handleNodeHover.js";

export function moveToMapCoordinates(nodeGroup, link, mapLayer, legendBox, projection, legendX,
    legendY, simulation, svg, topicColorMap) {
    link.transition().duration(1000).style("opacity", 0);
    simulation.stop();
    mapLayer.transition().delay(7000).duration(1000).style("opacity", 1);
    legendBox.transition().delay(4000).duration(1000).style("opacity", 1);
    // Remove existing text before appending new text to avoid double text
    nodeGroup.selectAll("text").remove();
    // Reverse styles applied in transformToCirclePack
    nodeGroup.selectAll("circle")
        .transition().duration(1000)
        .attr("r", d => d.group === "thema" ? 15 : 10)
        .style("fill", d => topicColorMap[d.group])
        .style("opacity", 1);
    // Append new text elements
    nodeGroup.append("text")
        .attr("dx", d => d.group === "thema" ? 20 : 12)
        .attr("dy", ".35em")
        .text(d => d.id)
        .style("opacity", 0);
    // Mouseover and mouseout events to control text visibility
    nodeGroup.selectAll("circle")
        .on("mouseover", function(event, d) {
            d3.select(this.parentNode).select("text").style("opacity", 1);
        })
        .on("mouseout", function(event, d) {
            d3.select(this.parentNode).select("text").style("opacity", 0);
        });
    // Apply transition for moving nodes
    nodeGroup.transition().delay(1000).duration(4000)
        .attr("transform", (d, i) => {
            if (d.koordinaten) {
                const [lat, lon] = d.koordinaten.split(", ").map(Number);
                const [x, y] = projection([lon, lat]);
                return `translate(${x},${y})`;
            } else if (d.group === "thema") {
                const x = legendX + 20;
                const y = legendY - 750 + i * 35;
                return `translate(${x},${y})`;
            }
            return "translate(-1000, -1000)";
        })
        .on("end", function() {
            // Ensure text for "thema" group is visible after transition
            nodeGroup.transition().delay(1000).selectAll("text").filter(function(d) {
                return d.group === "thema";
            }).style("opacity", 1);
        });
    nodeGroup.each(function(d) {
        if (d.geometry && d.geometry.type === "MultiLineString") {
            const multilinestring = d.geometry.coordinates;
            multilinestring.forEach(line => {
                // Apply the projection to each coordinate in the line
                const pathData = line.map(coord => {
                    if (!Array.isArray(coord) || coord.length < 2) return ""; // Ensure valid coordinates
                    const [x, y] = projection([coord[0], coord[1]]); // [x, y] order for projection
                    return `${x},${y}`;
                }).filter(Boolean).join("L"); // Filter out invalid points
                // Ensure pathData starts with M (move to the first point)
                const pathString = `M${pathData}`;
                // Append the path to SVG
                svg.append("path")
                    .attr("d", pathString)
                    .attr("fill", "none")
                    .attr("stroke", "grey")
                    .attr("stroke-width", 1)
                    .attr("opacity", 0.7)
                    .style("opacity", 0) // Start with path invisible
                    .transition()
                    .delay(5000) // Delay showing the geometry
                    .duration(1000) // Duration for fading in
                    .style("opacity", 1); // Fade in the path
            });
        }
    });
    nodeHover.handleNodeHover(nodeGroup, svg, projection);
    // Disable dragging while in map view
    nodeGroup.call(d3.drag().on("start", null).on("drag", null).on("end", null));
    nodeGroup.style("opacity", 1);
}

export default moveToMapCoordinates