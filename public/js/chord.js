import {Runtime, Library, Inspector} from "../external/js/runtime.unminified.noparamsdisplay.js";
// function _1(md){return(
//     md`# Directed Chord Diagram
//     )}

function _chart(d3,width,height,chord,matrix,DOM,outerRadius,ribbon,color,names,formatValue,arc)
{
    const svg = d3.create("svg")
        .attr("width", width*1.5)
        .attr("height", height*1.5)
        .attr("viewBox", [-width / 2, -height / 2, width, height]);

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
        .attr("fill", d => color(names[d.target.index]))
        .style("mix-blend-mode", "multiply")
    // The following acts as a tooltip over a ribbon
    .append("title")
        .text(d => `${names[d.source.index]} -> ${names[d.target.index]} : ${formatValue(d.source.value)} interactions`);

    const label_spread_factor = Math.round(names.length/10)
    const no_spread_threshold = Math.pow(names.length,0.06*names.length+0.66)
    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 8)
    .selectAll("g")
    .data(chords.groups)
    .join("g")
        .call(g => g.append("path")
        .attr("d", arc)
        .attr("fill", d => color(names[d.index]))
        .attr("stroke", "#fff"))
        .call(g => g.append("text")
        // Alternate label distances from outerRadius - an attempt to avoid labels overlapping each other
        .attr("dy", function(d) {
            let ret;
            let totalConnections = d3.sum(matrix[d.index]) + d3.sum(matrix, row => row[d.index]);
            if (totalConnections/names[d.index].length > no_spread_threshold || label_spread_factor == 0) {
                // If the proportion of label length is sufficiently small compared to the arch length,
                // no need to alternate labels
                ret = -3;
            } else if (totalConnections/names[d.index].length < 5) {
                ret = -3 - (15 * (d.index % label_spread_factor + 1));
            } else if (totalConnections/names[d.index].length < 15) {
                ret = -3 - (22 * (d.index % label_spread_factor + 1));
            } else {
                ret = -3 - (8 * (d.index % label_spread_factor + 1));
            }
            // console.log(names.length, names[d.index], totalConnections, totalConnections/names[d.index].length, ret);
            return ret;
        })
        .append("textPath")
        // Make xlink:href local to the page (i.e. #O-text-7 instead of http://localhost:8001/cpdbviz_chord.html#O-text-7)
        // otherwise chord arch labels don't show up when svg is saved via saveSvgAsPng
        // See: https://talk.observablehq.com/t/svg-textpath-not-working-in-local-image-viewers/2303
        .attr("xlink:href", "#" + textId.href.split("#")[1])
        .attr("startOffset", d => d.startAngle * outerRadius )
        .text(d => names[d.index]))
        // The following acts as a tooltip over a an outer ring corresponding to a cell type
        .call(g => g.append("title")
        .text(d => `${names[d.index]}
${formatValue(d3.sum(matrix[d.index]))} outgoing interactions
${formatValue(d3.sum(matrix, row => row[d.index]))} incoming interactions`));

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
d3.ribbonArrow()
    .radius(innerRadius - 0.5)
    .padAngle(1 / innerRadius)
)}

// https://stackoverflow.com/questions/34163662/is-there-a-way-to-generate-more-than-20-colors-in-d3
var d3_category20 = [
    0x1f77b4, 0xaec7e8,
    0xff7f0e, 0xffbb78,
    0x2ca02c, 0x98df8a,
    0xd62728, 0xff9896,
    0x9467bd, 0xc5b0d5,
    0x8c564b, 0xc49c94,
    0xe377c2, 0xf7b6d2,
    0x7f7f7f, 0xc7c7c7,
    0xbcbd22, 0xdbdb8d,
    0x17becf, 0x9edae5
    ].map(d3_rgbString);
    
function d3_rgbString (value) {
    return d3.rgb(value >> 16, value >> 8 & 0xff, value & 0xff);
}

function _color(d3,names){return(
    // d3.scaleOrdinal(names, d3.schemeCategory10)
    d3.scaleOrdinal(names, d3_category20)
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

function define(main, observer, data, plotCnt) {
     // datasome: Removed plot title: main.variable(observer()).define(["md"], _1);
     main.variable(observer("chart")).define("chart", ["d3","width","height","chord","matrix","DOM","outerRadius","ribbon","color","names","formatValue","arc"], _chart);
     main.variable(observer("data")).define("data", [], data);
     main.variable(observer("names")).define("names", ["data"], _names);
     main.variable(observer("matrix")).define("matrix", ["names","data"], _matrix);
     main.variable(observer("chord")).define("chord", ["d3","innerRadius"], _chord);
     main.variable(observer("arc")).define("arc", ["d3","innerRadius","outerRadius"], _arc);
     main.variable(observer("ribbon")).define("ribbon", ["d3","innerRadius"], _ribbon);
     main.variable(observer("color")).define("color", ["d3","names"], _color);
     main.variable(observer("formatValue")).define("formatValue", _formatValue);
     // all cell types default
     var innerRadius = 150;
     var outerRadius = 156;
     var size = 400;
     if (plotCnt > 0) {
        // microenvironments
        innerRadius = 70;
        outerRadius = 76;
        size = 200;
     }
     main.variable(observer("outerRadius")).define("outerRadius", ["innerRadius"], outerRadius);
     main.variable(observer("innerRadius")).define("innerRadius", ["width","height"], innerRadius);
     main.variable(observer("width")).define("width", size);
     main.variable(observer("height")).define("height", ["width"], size);
     main.variable(observer("d3")).define("d3", ["require"], _d3);
 }

 export default function generateCellCellInteractionSummaryChordPlot(data, cellTypes, plotCnt) {
    const num_ints_csv = filterNumInteractions(data, cellTypes, false);
    // See: https://observablehq.com/@observablehq/advanced-embeds
    // See: https://observablehq.com/@observablehq/stdlib
    // See: https://github.com/observablehq/inspector
    // See: https://github.com/observablehq/runtime
    const runtime = new Runtime();
    const module = runtime.module();
    const observer = Inspector.into(document.querySelector("#cci"+plotCnt + "_chord"));
    const chordData = d3.csvParse(num_ints_csv, d3.autoType);
    define(module, observer, chordData, plotCnt);
 }