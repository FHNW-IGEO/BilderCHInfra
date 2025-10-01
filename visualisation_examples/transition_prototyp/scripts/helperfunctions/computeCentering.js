export function computeCentering(features, scaleFactor = 1, width, height) {
        const projection = d3.geoMercator().scale(scaleFactor);
        const geoPathGenerator = d3.geoPath().projection(projection);
        const bounds = d3.geoBounds({type: "FeatureCollection", features});
        const [[x0, y0],[x1, y1]] = bounds;
        const centerX = (x0 + x1) / 2;
        const centerY = (y0 + y1) / 2;
        projection.center([centerX, centerY]).translate([width / 2, height / 2]);
        return {projection, geoPathGenerator};
    }

export default computeCentering