// Select the info-container and get its dimensions dynamically
const container = document.querySelector(".info-chart");
const containerWidth = container.clientWidth;
const containerHeight = container.clientHeight;
const margin = { top: 40, right: 20, bottom: 40, left: 50 };
const width = containerWidth - margin.left - margin.right;
const height = containerHeight - margin.top - margin.bottom;

// Create an SVG inside the .info-chart div
const svg = d3.select(".info-chart")
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// X-Axis labels
const xLabels = ["A", "T", "S", "R"];
const xScale = d3.scalePoint()
    .domain(xLabels)
    .range([3, width]);

// Y-Axis labels
const yLabels = ["-", "+", "++"];
const yScale = d3.scalePoint()
    .domain(yLabels)
    .range([height, 0]);

const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => d); // Default tick format for y-axis

// Function to get data based on slider value
function getData(sliderValue) {
    if (sliderValue === 0) {
        return [
            { x: "A", y: "+" },
            { x: "T", y: "+" },
            { x: "S", y: "-" },
            { x: "R", y: "++" }
        ];
    } else if (sliderValue === 50) {
        return [
            { x: "A", y: "+" },
            { x: "T", y: "+" },
            { x: "S", y: "++" },
            { x: "R", y: "-" }
        ];
    } else if (sliderValue === 100) {
        return [
            { x: "A", y: "++" },
            { x: "T", y: "-" },
            { x: "S", y: "-" },
            { x: "R", y: "+" }
        ];
    }
    return [];
}

// Function to update the chart
function updateChart(sliderValue) {
    const data = getData(sliderValue);

    // Convert data to pixel values
    const lineData = data.map(d => ({
        x: xScale(d.x),
        y: yScale(d.y)
    }));

    // Update line
    const line = d3.line()
        .x(d => d.x)
        .y(d => d.y);

    const path = svg.selectAll(".line-path").data([lineData]);

    path.enter()
        .append("path")
        .attr("class", "line-path")
        .merge(path)
        .transition()
        .duration(500)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", line);

    path.exit().remove();

    // Update circles
    const circles = svg.selectAll("circle").data(lineData);

    circles.enter()
        .append("circle")
        .merge(circles)
        .transition()
        .duration(500)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", 4)
        .attr("fill", "steelblue");

    circles.exit().remove();

    // Add vertical lines for each domain value on x-axis
    const verticalLines = svg.selectAll(".vertical-line")
        .data(xLabels);

    verticalLines.enter()
        .append("line")
        .attr("class", "vertical-line")
        .merge(verticalLines)
        .transition()
        .duration(500)
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", height)
        .attr("stroke", "gray")
        .attr("stroke-width", 1);

    verticalLines.exit().remove();

    // Add x-axis labels manually
    const xAxisLabels = svg.selectAll(".x-axis-label")
        .data(xLabels);

        // Add x-axis labels manually
        const yAxisLabels = svg.selectAll(".y-axis-label")
        .data(yLabels);

        yAxisLabels.enter()
        .append("text")
        .attr("class", "x-axis-label")
        .merge(xAxisLabels)
        .attr("x",-20)
        .attr("y",  d => yScale(d))  // Position labels just below the chart
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .text(d => d);

    yAxisLabels.exit().remove();

    xAxisLabels.enter()
        .append("text")
        .attr("class", "x-axis-label")
        .merge(xAxisLabels)
        .attr("x", d => xScale(d))
        .attr("y", height + 20)  // Position labels just below the chart
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .text(d => d);

    xAxisLabels.exit().remove();
}

document.getElementById("slider").addEventListener('input', function() {
    const value = +this.value;
    console.log(value)
    updateChart(value);
});

// Initialize chart with default data
updateChart(0);

