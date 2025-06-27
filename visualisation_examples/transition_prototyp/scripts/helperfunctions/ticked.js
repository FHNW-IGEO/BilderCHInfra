export function ticked(linkSelection, nodeSelection, width, height, radius = 10) {
    linkSelection
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    nodeSelection
        .attr("transform", d => {
            // Clamp x and y to stay within bounds, taking radius into account
            d.x = Math.max(radius, Math.min(width - radius, d.x));
            d.y = Math.max(radius, Math.min(height - radius, d.y));
            return `translate(${d.x},${d.y})`;
        });
}

export default ticked