import {Runtime, Library, Inspector} from "../external/js/runtime.unminified.noparamsdisplay.js";

function _chart(d3,width,height,chord,matrix,DOM,outerRadius,ribbon,color,names,formatValue,arc,title,minNumInts,maxNumInts)
{
    if (maxNumInts == 0) {
        return;
    }
    const svg = d3.create("svg")
        .attr("width", width*1.6)
        .attr("height", height*1.6)
        .attr("viewBox", [-width / 1.6, -height / 1.6, width + 50, height + 50]);

    // Insert title
    svg.append("text")
        .attr("x", -width / 2 + (width + 50)/2 - title.length*4)
        .attr("y", -height * 0.45)
        .style("font-size", "12px")
        .attr("font-weight", 400)
        .text(title)

    const chords = chord(matrix);

    const textId = DOM.uid("text");

    svg.append("path")
        .attr("id", textId.id)
        .attr("fill", "none")
        .attr("d", d3.arc()({outerRadius, startAngle: 0, endAngle: 2 * Math.PI}));

    svg.append("g")
        .attr("fill-opacity", 0.75)
    .selectAll("g")
    .data(chords)
    .join("path")
        .attr("d", ribbon)
        .attr("fill", d => color(d.target.value))
        .style("mix-blend-mode", "multiply")
    // The following acts as a tooltip over a ribbon
    .append("title")
        .text(d => `${names[d.source.index]} - ${names[d.target.index]} : ${formatValue(d.source.value)} interactions`);

    // Work our parameters for placement of labels
    // NB. Maximum 4 levels of spread for labels
    const label_spread_factor = Math.min(4, Math.round(names.length/10) + 1);
    var total_connections_per_ct = [];
    for (var i = 0; i < matrix.length; i++) {
       total_connections_per_ct.push(d3.sum(matrix[i]) + d3.deviation(matrix, row => row[i]));
    }
    const no_spread_cutoff = d3.mean(total_connections_per_ct) + 2 * d3.deviation(total_connections_per_ct);

    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 8)
    .selectAll("g")
    .data(chords.groups)
    .join("g")
        .call(g => g.append("path")
        .attr("d", arc)
        // Set the colour of the outer ring to light grey
        .attr("fill", d => "#B9BBB6")
        .attr("stroke", "#fff"))
        .call(
    g => g.append("text")
      .each(d => (d.angle = (d.startAngle + d.endAngle) / 2))
      .attr("dy", "0.35em")
      .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${outerRadius + 5})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
      .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
      .text(d => names[d.index])
      )

        // The following acts as a tooltip over a an outer ring corresponding to a cell type
        .call(g => g.append("title")
        .text(d => `${names[d.index]}
${formatValue(d3.sum(matrix[d.index]))} outgoing interactions
${formatValue(d3.sum(matrix, row => row[d.index]))} incoming interactions`));

  // Display colour legend bar
    var min_ints = parseInt(minNumInts);
    var max_ints = parseInt(maxNumInts);
    const colorscale = d3
      .scaleSequential()
      .domain([max_ints, min_ints])
      // See: https://observablehq.com/@d3/sequential-scales
      .interpolator(d3.interpolateRdYlBu)

    var legend_width=30,
    legend_height=100,
    legend_xPos= -width/1.7,
    title_xPos = legend_xPos * 0.5,
    legend_yPos=-45;

  // Colour legend:
  // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
  // Band scale for x-axis

  const domain=[min_ints, max_ints]
  const legend_xScale = d3
    .scaleBand()
    .domain([0, 1])
    .range([0, legend_width]);

  // Linear scale for y-axis
  const legend_yScale = d3
    .scaleLinear()
    .domain(domain)
    .range([legend_height, 0]);

  // An array interpolated over our domain where height is the height of the bar
  // Padding the domain by 3%
  // This will have an effect of the bar being 3% longer than the axis label
  // (otherwise top/bottom figures on the legend axis would be cut in half)
  const paddedDomain = fc.extentLinear()
    .pad([0.03, 0.03])
    .padUnit("percent")(domain);
  [min_ints, max_ints] = paddedDomain;
  const expandedDomain = d3.range(min_ints, max_ints, (max_ints - min_ints) / legend_height);

  // Define the colour legend bar
  const svgBar = fc
    .autoBandwidth(fc.seriesSvgBar())
    .xScale(legend_xScale)
    .yScale(legend_yScale)
    .crossValue(0)
    .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : min_ints))
    .mainValue(d => d)
    .decorate(selection => {
      selection.selectAll("path").style("fill", d => colorscale(d));
    });

    // Add the colour legend header
    svg
    .append("text").attr("x", legend_xPos - 7).attr("y", -65).text("Number of").style("font-size", "10px")
    .append('tspan').attr("x", legend_xPos - 7).attr("y", -55).text("interactions")
    .attr("alignment-baseline","middle");

  // Draw the legend bar
  const colourLegendBar = svg
    .append("g")
    .attr("transform", function() {
        return "translate(" + legend_xPos + "," + legend_yPos + ")";
      })
    .datum(expandedDomain)
    .call(svgBar);

  // Linear scale for legend label
  const legendLabel_yScale = d3
    .scaleLinear()
    .domain(paddedDomain)
    .range([legend_height, 0]);

  // Defining our label
  const axisLabel = fc
    .axisRight(legendLabel_yScale)
    .tickValues([...domain, (domain[1] + domain[0]) / 2])
    .tickSizeOuter(0);

  // Drawing and translating the label
  colourLegendBar.append("g")
    // .attr("transform", `translate(${barWidth})`)
    .attr("transform", "translate(" + 15 + ")")
    .datum(expandedDomain)
    .call(axisLabel)
    .select(".domain")
    .attr("visibility", "hidden");
  // Display colour legend bar - end

    return svg.node();
}

function _names(data){return(
    Array.from(new Set(data.flatMap(d => [d.source, d.target])))
)}

function _matrix(names,data)
{
    const index = new Map(names.map((name, i) => [name, i]));
    const matrix = Array.from(index, () => new Array(names.length).fill(0));
    for (const {source, target, value} of data) matrix[index.get(source)][index.get(target)] += value;
    return matrix;
}


function _chord(d3,innerRadius){return(
d3.chordDirected()
    .padAngle(12 / innerRadius)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending)
)}

function _arc(d3,innerRadius,outerRadius){return(
d3.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
)}

function _ribbon(d3,innerRadius){return(
d3.ribbon()
    .radius(innerRadius - 0.5)
    .padAngle(1 / innerRadius)
)}

function d3_rgbString (value) {
    return d3.rgb(value >> 16, value >> 8 & 0xff, value & 0xff);
}

function _color(d3,minNumInts, maxNumInts){
  return(d3
  .scaleSequential()
  .domain([maxNumInts, minNumInts])
  .interpolator(d3.interpolateRdYlBu)
)}

function _formatValue(){return(
x => `${x.toFixed(0)}` 
)}


function _outerRadius(innerRadius){return(
innerRadius + 6
)}

function _innerRadius(width,height){return(
Math.min(width, height) * 0.5 - 20
)}

function _width(){return(
840
)}

function _height(width){return(
width
)}

function _d3(require){return(
require("d3@6")
)}

function define(main, observer, data, title, plotCnt, min_num_ints, max_num_ints) {
     main.variable(observer("chart")).define("chart", ["d3","width","height","chord","matrix","DOM","outerRadius","ribbon","color","names","formatValue","arc","title","minNumInts","maxNumInts"], _chart);
     main.variable(observer("data")).define("data", [], data);
     main.variable(observer("title")).define("title", [], title);
     main.variable(observer("names")).define("names", ["data"], _names);
     main.variable(observer("matrix")).define("matrix", ["names","data"], _matrix);
     main.variable(observer("chord")).define("chord", ["d3","innerRadius"], _chord);
     main.variable(observer("arc")).define("arc", ["d3","innerRadius","outerRadius"], _arc);
     main.variable(observer("ribbon")).define("ribbon", ["d3","innerRadius"], _ribbon);
     main.variable(observer("color")).define("color", ["d3","minNumInts","maxNumInts"], _color);
     main.variable(observer("formatValue")).define("formatValue", _formatValue);
     // all cell types default
     var innerRadius = 200;
     var outerRadius = 206;
     var size = 800;
     if (plotCnt > 0) {
        // microenvironments
        innerRadius = 70;
        outerRadius = 76;
        size = 300;
     }
     main.variable(observer("outerRadius")).define("outerRadius", ["innerRadius"], outerRadius);
     main.variable(observer("innerRadius")).define("innerRadius", ["width","height"], innerRadius);
     main.variable(observer("width")).define("width", size);
     main.variable(observer("height")).define("height", ["width"], size);
     main.variable(observer("minNumInts")).define("minNumInts", [], min_num_ints);
     main.variable(observer("maxNumInts")).define("maxNumInts", [], max_num_ints);
     main.variable(observer("d3")).define("d3", ["require"], _d3);
 }

 export default function generateCellCellInteractionSummaryChordPlot(data, cellTypes, title, plotCnt, min_num_ints, max_num_ints) {
    const num_ints_csv = filterNumInteractions(data, cellTypes, false);
    // See: https://observablehq.com/@observablehq/advanced-embeds
    // See: https://observablehq.com/@observablehq/stdlib
    // See: https://github.com/observablehq/inspector
    // See: https://github.com/observablehq/runtime
    const runtime = new Runtime();
    const module = runtime.module();
    const plotId = "#cci"+plotCnt + "_chord";
    // Remove any previous chord plot first
    $(plotId).empty();
    const observer = Inspector.into(document.querySelector(plotId));
    const chordData = d3.csvParse(num_ints_csv, d3.autoType);
    define(module, observer, chordData, title, plotCnt, min_num_ints, max_num_ints);
 }