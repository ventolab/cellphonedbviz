document.addEventListener('DOMContentLoaded', function() {

  var projectId = $("#project_id").text();

  // Enable tooltips
  var elems = document.querySelectorAll('.tooltipped');
  const options = {};
  var instances = M.Tooltip.init(elems, options);

   // Populate page title
   $.ajax({
            url: '/api/list',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                $("#page_header").text(res[projectId]);
                $("#page_title").text(res[projectId]);
            }
    });
    // Generate cell type composition plot
    $.ajax({
        url: '/api/data/'+projectId+'/celltype_composition',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
          generateCellCompositionPlot(res);
        }
    });

    // Generate spatial micro-environments plot
    $.ajax({
            url: '/api/data/'+projectId+'/microenvironments',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                generateMicroenvironmentsPlot(res);
            }
    });

    // Generate single gene expression plot
    $.ajax({
        url: '/api/data/'+projectId+'/single_gene_expression',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
            generateSingleGeneExpressionPlot(res, storeTokens=true);
            // Enable gene and cell type input autocompletes for gene expression plot
            enable_autocomplete('sge_gene_input', 'sge_selected_genes', res['all_genes']);
            enable_autocomplete('sge_celltype_input', 'sge_selected_celltypes', res['all_cell_types']);
            if (res.hasOwnProperty('microenvironments')) {
                enable_autocomplete('sge_microenvironment_input', 'sge_selected_microenvironments', res['microenvironments']);
                // Initialise 'Filter cell types by micro-environment in single gene expression plot' select dropdown
                enable_me2ct_select(res['microenvironment2cell_types'], res['all_cell_types'],
                                        'sge_selected_microenvironments', 'sge_selected_celltypes', 'sge_celltype_input');
                // Populate placeholder to show the user available microenvironments
                $("#sge_microenvironment_input")
                    .attr("placeholder",res['microenvironments'].toString());
            } else {
                // Hide microenvironment input
                $("#sge_microenvironment_sel").hide();
            }
        }
     });

     // Generate cell-cell interaction summary plot
    $.ajax({
        url: '/api/data/'+projectId+'/cell_cell_interaction_summary',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
           if (res.hasOwnProperty('microenvironment2cell_types')) {
                microenvironment2cell_types = res['microenvironment2cell_types'];
                const map = new Map(Object.entries(microenvironment2cell_types));
                if (map.size > 0) {
                    var cnt = 1;
                    for (let [microenvironment, cellTypes] of map.entries()) {
                        generateCellCellInteractionSummaryPlot(res, cellTypes.sort(), microenvironment, cnt);
                        cnt++;
                        if (cnt > 9) {
                            // TODO: We currently only have up to nine slots for microenvironment-specific cci plots - to be reviewed
                            break;
                        }
                    }
                    // Generate plot across cell types also - in case the user wishes to see it
                   generateCellCellInteractionSummaryPlot(res, res['all_cell_types'], "All cell types", 0);
                   $("#cci0_div").hide();

                } else {
                    generateCellCellInteractionSummaryPlot(res, res['all_cell_types'], "All cell types", 0);
                    // Hide microenvironment input
                    $("#cci_search_microenvironment_sel").hide();
                }
            } else {
                generateCellCellInteractionSummaryPlot(res, res['all_cell_types'], "All cell types", 0);
                // Hide microenvironment input
                $("#cci_search_microenvironment_sel").hide();
            }
            // Allow the user to switch between cci_summary heatmaps and chord plots
            enable_cci_summary_switch();
        }
     });

    // Generate cell-cell interaction search plot
    $.ajax({
        url: '/api/data/'+projectId+'/cell_cell_interaction_search',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
            generateCellCellInteractionSearchPlot(res, storeTokens=true, showZScores=false);
            // Enable gene and cell type input autocompletes for gene expression plot
            enable_autocomplete('cci_search_celltype_input', 'cci_search_selected_celltypes', res['all_cell_types']);
            enable_autocomplete('cci_search_celltype_pair_input', 'cci_search_selected_celltype_pairs', res['all_cell_type_pairs']);
            enable_autocomplete('cci_search_gene_input', 'cci_search_selected_genes', res['all_genes']);
            enable_autocomplete('cci_search_interaction_input', 'cci_search_selected_interactions', res['all_interacting_pairs']);
            if (res.hasOwnProperty('microenvironments')) {
                enable_autocomplete('cci_search_microenvironment_input', 'cci_search_selected_microenvironments', res['microenvironments']);
                // Populate 'filter cell types by micro-environment' select dropdown for single-gene expression plot
                $.each(res['microenvironments'], function (i, item) {
                  $('#cci_search_me_filter').append($('<option>', {
                      value: item,
                      text : item
                  }));
                });
                // Initialise 'Filter cell types by micro-environment in 'cell-cell interaction search' plot select dropdown
                enable_me2ct_select(res['microenvironment2cell_types'], res['all_cell_types'],
                                        'cci_search_selected_microenvironments','cci_search_selected_celltypes', 'cci_search_celltype_input');
                // Populate placeholder to show the user available microenvironments
                $("#cci_search_microenvironment_input")
                    .attr("placeholder",res['microenvironments'].toString());
            }
            // Allow the user to switch between mean expressions and z-scores being shown in the plot
            enable_cci_search_switch();
        }
     });

});

function downloadAsPDF(divId, titleId, headerId) {
    var options = {};
    var div = $("#" + divId);
    const is_cci = divId.search(/cci\d/ != -1);
    // See: https://cdn.jsdelivr.net/npm/pdfkit@0.10.0/js/pdfkit.standalone.js
    const svgWidth = parseInt(div.find('svg').attr('width'));
    const svgHeight = parseInt(div.find('svg').attr('height'));
    options['size'] = [svgWidth, svgHeight];
    options['assumePt'] = true;
    options['compress'] = false;
    options['useCSS'] = true;
    if (is_cci && div.is(":hidden")) {
         div = $("#" + divId + "_chord");
         options['size'] = [svgWidth, svgHeight * 1.2];
    }
    const svg = div.find("svg")[0];
    const title = document.getElementById(titleId).innerHTML;
    const header = document.getElementById(headerId).innerHTML;
    const fileName = (title + "-" + header).replace(/ /g, '_').toLowerCase();
    downloadPDF(svg, fileName, options);
}

function downloadPDF(svg, outFileName, options) {
    let doc = new PDFDocument(options);
    SVGtoPDF(doc, svg, 0, 0, options);
    let stream = doc.pipe(blobStream());
    stream.on('finish', () => {
      let blob = stream.toBlob('application/pdf');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = outFileName + ".pdf";
      link.click();
    });
    doc.end();
}

function enable_cci_summary_show_all_celltypes() {
    $('#cci_summary_show_all_celltypes').on('change', function() {
        if ($(this).is(':checked')) {
          $('#cci0_div').show();
        } else {
           $('#cci0_div').hide();
        }
      });
}

function enable_cci_search_switch() {
    $('#cci_search_switch').on('change', function() {
        var showZScores = false;
        if ($(this).is(':checked')) {
            showZScores = true;
        }
        refreshCCISearchPlot(showZScores);
      });
}

function enable_cci_summary_switch() {
    $('#cci_summary_switch').on('change', function() {
        var max_cci_summary_plot_number= 9;
        var i = 0;
        if ($(this).is(':checked')) {
            // Hide all heatmaps and show chords

            while (i <= max_cci_summary_plot_number) {
                const divId = "#cci" + i
                if ($(divId).is(':visible') || i == 0) {
                    $(divId).hide();
                    $(divId + "_chord").show();
                }
                i++;
            }
        } else {
            // Hide all chords and show heatmaps
            while (i <= max_cci_summary_plot_number) {
                const divId = "#cci" + i
                if ($(divId+ "_chord").is(':visible') || i == 0) {
                    $(divId+ "_chord").hide();
                    $(divId).show();
                }
                i++;
            }
        }
      });
}

function enable_me2ct_select(microenvironment2cell_types, all_cell_types,
                             selected_microenvironments_div, selected_celltypes_div, celltype_input_div) {
    var elems = document.querySelectorAll('select');
    var options = {};
    var instances = M.FormSelect.init(elems, options);
    $('.' + selected_microenvironments_div).on('DOMSubtreeModified', function(event){
        var selected_microenvironments = $("."+selected_microenvironments_div).map((_,el) => el.innerText.replace(/(\n)*close(\n)*/g,",").replace(/,$/,"")).get()[0];
        if (selected_microenvironments) {
            var sel_mes_set = new Set();
            for (sel_me of selected_microenvironments.split(',')) {
                cts = microenvironment2cell_types[sel_me];
                sel_mes_set = new Set([ ...sel_mes_set, ...cts ]);
            }
            selected_cell_types = Array.from(sel_mes_set).sort();
            // DEBUG console.log(selected_cell_types);
            if (selected_microenvironments_div == 'sge_selected_microenvironments') {
               $('.sge_selected_celltypes').hide();
               $('#sge_celltype_input').prop( "disabled", true );
               $('#sge_select_all_celltypes').addClass('disabled');
            } else if (selected_microenvironments_div == 'cci_search_selected_microenvironments') {
              // Disable cell type and cell type pair inputs as the requirement is for
              // microenvironments, cell type and cell type pair inputs to be mutually exclusive
              $('#cci_search_celltype_input').prop( "disabled", true );
              $('#cci_search_celltype_pair_input').prop( "disabled", true );
              $('.cci_search_selected_celltypes').hide();
              $('.cci_search_selected_celltype_pairs').empty();
              $('#cci_search_select_all_celltypes').addClass('disabled');
            }
        } else {
            selected_cell_types = all_cell_types;
            if (selected_microenvironments_div == 'sge_selected_microenvironments') {
               $('.sge_selected_celltypes').show();
               $('#sge_celltype_input').prop( "disabled", false );
               $('#sge_select_all_celltypes').removeClass('disabled');
            } else if (selected_microenvironments_div == 'cci_search_selected_microenvironments') {
              $('#cci_search_celltype_input').prop( "disabled", false );
              $('#cci_search_celltype_pair_input').prop( "disabled", false );
              $('.cci_search_selected_celltypes').show();
              $('#sge_select_all_celltypes').prop( "disabled", false );
              $('#cci_search_select_all_celltypes').removeClass('disabled');
            }
        }
        // Replace any previously select cell types in selected_celltypes_div with the ones in the selected microenvironments
        // We're effectively forcing the user to select either cell types or microenvironments, but not both.
        $('.'+ selected_celltypes_div).empty();
        for (var i = 0; i < selected_cell_types.length; i++) {
            storeToken(selected_cell_types[i], selected_celltypes_div, celltype_input_div);
        }
    });
}

function selectAllCellTypes(viz){
    var projectId = $("#project_id").text();
    var url = '/api/data/'+projectId+'/' + viz;
    $.ajax({
            url: url,
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                var data;
                var selected_celltypes_div;
                var celltype_input_div;
                if (viz == 'single_gene_expression') {
                   data = res;
                   selected_celltypes_div = "sge_selected_celltypes";
                   celltype_input_div = "sge_celltype_input";
                } else if (viz == 'cell_cell_interaction_search') {
                   data = res;
                   selected_celltypes_div = "cci_search_selected_celltypes";
                   celltype_input_div = "cci_search_celltype_input";
                   $(".cci_search_selected_celltype_pairs").empty();
                }

                if (selected_celltypes_div) {
                    $("." + selected_celltypes_div).empty();
                    for (var i = 0; i < data['all_cell_types'].length; i++) {
                        storeToken(data['all_cell_types'][i], selected_celltypes_div, celltype_input_div);
                    }
                }
            }
     });

}

function enable_autocomplete(input_field_id, target_div_class, vals) {
    const autocomplete_data = Object.fromEntries(vals.map(e => [e, null]));
    const options = {
        data : autocomplete_data,
        sortFunction : sortBy,
        limit: 5,
        onAutocomplete: function(val) {
            storeToken(val, target_div_class, input_field_id)
        }
    }
    var elems = document.querySelectorAll('#'+input_field_id);
    var instances = M.Autocomplete.init(elems, options);
}

// Sort function for sorting autocomplete results
function sortBy(a, b) {
  return  b > a;
}


// Collect genes and cell types selected in sge_selected_genes and sge_selected_celltypes divs respectively
function getSelectedTokens(divClassList) {
    var selectedTokens = [];
    for (let i = 0; i < divClassList.length; i++) {
        divClass = divClassList[i];
        var vals = $("."+divClass).map((_,el) => el.innerText.replace(/(\n)*close(\n)*/g,",").replace(/,$/,"")).get()[0];
        if (vals) {
            selectedTokens[i] = vals.split(",");
        }
    }
    return selectedTokens;
}

function refreshSGEPlot() {
    var projectId = $("#project_id").text();
    var ret = getSelectedTokens(["sge_selected_genes", "sge_selected_celltypes"]);
    var selectedGenes = ret[0];
    var selectedCellTypes = ret[1];
    var url = '/api/data/'+projectId+'/single_gene_expression';
    if (selectedGenes || selectedCellTypes) {
        url += "?";
        if (selectedGenes) {
            url += "genes=" + selectedGenes + "&";
        }
        if (selectedCellTypes) {
            url += "cell_types=" + selectedCellTypes + "&";
        }
    } else {
        url += "?";
    }
    // In refresh mode, we don't pre-select interactions/cell type pairs - if the user did not enter any selections
    url += "refresh_plot=True";
    $.ajax({
            url: url,
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                generateSingleGeneExpressionPlot(res, storeTokens=false);
            }
     });
}

function storeToken(newVal, target_div_class, input_field_id) {
    let found = false;
    $("."+target_div_class + " .chip").each(function(index, element) {
        const chipVal = $(this).text().replace("close","");
        if (newVal == chipVal) {
            found = true;
        }
    });
    if (!found) {
        $("."+target_div_class).append($('<div class="chip">' + newVal + '<i class="tiny close material-icons">close</i></div>'));
    }
    $('#' + input_field_id).val("");
}

function generateCellCompositionPlot(data) {
    if (!data.hasOwnProperty('all_elems')) {
        // N.B. 'all_elems' is set only if celltype_composition is set in config
        $("#ctcomp_title").hide();
        $("#ctcomp").hide();
        $("#ctcomp_save_button").hide();
        return;
    }

     var edges = data['edges'];
     var numStacks = data['num_stacks'];
      $("#ctcomp_header").text(data['title']);
      var sankey = new Sankey('ctcomp');
      sankey.stack(0,data['list0'],data['y_space0'],data['y_box0']);
      sankey.stack(1,data['list1'],data['y_space1'],data['y_box1']);
      sankey.stack(2,data['list2'],data['y_space2'],data['y_box2']);
      sankey.stack(3,data['list3'],data['y_space3'],data['y_box3']);
      sankey.stack(4,data['list4'],data['y_space4'],data['y_box4']);
      sankey.stack(5,data['list5'],data['y_space5'],data['y_box5']);
      var elem2colour = {};
      // See: https://observablehq.com/@d3/color-schemes
      // const colours = d3.schemeTableau10.reverse();
      const colours = d3.schemePaired;
      var elems = data['all_elems'];
      for (var i = 0; i < elems.length; i++) {
        elem = elems[i];
        elem2colour[elem] = colours[i % colours.length];
      }
      // Colours
      sankey.setColors(elem2colour);
      sankey.right_margin = 100;
      sankey.left_margin = -100 * numStacks + 400;
      sankey.box_width = 60;
      // Box height
      sankey.convert_flow_values_callback = function(flow) {
        return flow * 0.05;
      };
      sankey.convert_flow_labels_callback = function(flow) {
        // Switched off edge labels: return Math.round(flow);
        return "";
      };
      sankey.convert_box_value_labels_callback = function(flow) {
        // Switched off edge labels: return (""+Math.round(flow))
        return "";
      };
      sankey.setData(edges);

      // Insert title
      sankey.r.text(sankey.left_margin + 250, 10, data['title']).attr({
        'font-size': '16px',
        'font-weight': '100'
      });
      sankey.draw();
}

function generateMicroenvironmentsPlot(data) {

    if (!data.hasOwnProperty('color_domain')) {
        // N.B. 'color_domain' is set only if microenvironments is provided in config
        $("#spme_title").hide();
        $("#spme_header").hide();
        $("#spme").hide();
        $("#spme_save_button").hide();
        return;
    }

     var height = 500,
        width = 600,
        xMargin = 200,
        top_yMargin = 60,
        bottom_yMargin = 90,
        yVals = data['y_vals'],
        yMin = -1,
        xMin = -1,
        yMax = yVals.length - 1,
        xVals = data['x_vals'],
        xMax= xVals.length - 1,
        mapping = data['raw_data'];

    colorDomain = data['color_domain'];
    // NB. spme_header is hard-coded in html
    // $("#spme_header").text(data['title']);

    var svg = d3
        .select("#spme")
        .append("svg")
        .attr("class", "axis")
        .attr("width", width)
        .attr("height", height);

    // Insert title
    const title = "Cell Type - Microenvironment";
    svg.append("text")
        .attr("x", (- xMargin + width) / 2)
        .attr("y", 12)
        .style("font-size", "16px")
        .attr("font-weight", 400)
        .attr("font-family", "Arial")
        .text(title)

      var yAxisLength = height - top_yMargin - bottom_yMargin,
        xAxisLength = width - 2 * xMargin;

      var xScale = d3
          .scaleLinear()
          .domain([xMin, xMax])
          .range([0, xAxisLength]),
          yScale = d3
          .scaleLinear()
          .domain([yMax, yMin])
          .range([0, yAxisLength]),
        colorscale = d3.scaleOrdinal()
          .domain(colorDomain)
          .range(d3.schemeTableau10);

      spmeRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale);
      spmeRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin);
      for (var i = 0; i <= mapping.length - 1; i++) {
        vals = mapping[i];
        yPos = yVals.indexOf(vals[0]);
        xPos = xVals.indexOf(vals[1]);
        colorPos = colorDomain.indexOf(vals[1]);
        spmeRenderPoint(svg, xPos, yPos, colorPos, xMargin, top_yMargin, xScale, yScale, colorscale);
      }

      svg.selectAll("legend_dots")
        .data(colorDomain)
        .enter()
        .append("circle")
          .attr("cx", width - 180)
          .attr("cy", function(d,i){ return top_yMargin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .attr("r", 7)
          .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})

      svg.selectAll("legend_labels")
        .data(colorDomain)
        .enter()
        .append("text")
          .attr("x", width - 160)
          .attr("y", function(d,i){ return top_yMargin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})
          .text(function(d){ return d})
          .attr("text-anchor", "left")
          .style("alignment-baseline", "middle");
}

function spmeRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin) {
    var xAxis = d3
      .axisBottom()
      .ticks(xVals.length)
      .tickFormat(t => {
        return xVals[t];
      })
      .scale(xScale);
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("id", "spme_x-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + (height - bottom_yMargin) + ")";
      })
      .attr("opacity", 1)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    d3.selectAll("#spme_x-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", -(height - top_yMargin - bottom_yMargin));
}

function spmeRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale) {
    var yAxis = d3
      .axisLeft()
      .ticks(yVals.length)
      .tickFormat(t => {
        return yVals[t];
      })
      .scale(yScale);
    svg
      .append("g")
      .attr("class", "y-axis")
      .attr("id", "spme_y-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + top_yMargin + ")";
      })
      .call(yAxis);

    d3.selectAll("#spme_y-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxisLength)
      .attr("y2", 0)
      .attr("fill", colorscale(0));
}

function spmeRenderPoint(svg, x, y, colorPos, xMargin, top_yMargin, xScale, yScale, colorscale) {
    svg
      .append("circle")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + top_yMargin + ")";
      })
      .attr("cx", xScale(x))
      .attr("cy", yScale(y))
      .attr("fill", colorscale(colorPos))
      // .attr("r", xScale(x)/25);
      .attr("r", 7);
}

function validateInput(data) {
    var errMsg;
    if (data['cell_types'].length == 0) {
        if (data['genes'].length == 0) {
            errMsg = 'Please select at least one gene and at least two cell types.';
        } else {
            errMsg = 'Please select at least two cell types.';
        }
    } else if (data['cell_types'].length == 1) {
        // Z-scores (calculated across all selected cell types) cannot be calculated when only
        // one cell type has been selected - report an error
        errMsg = 'The plot shows z-scores that cannot be calculated if only one cell type has been selected. Please select more than one cell type.';
    } else if (data['mean_zscores'].length == 0) {
        errMsg = 'No expressions were found - please try another search.'
    }
    return errMsg;
}

function generateSingleGeneExpressionPlot(data, storeTokens) {
    // Remove previous plot if there
    $("#sge").empty();
    var unique_genes = [];
    for (var i = 0; i < data['gene_complex'].length; i++) {
        gene = data['gene_complex'][i].split(" ")[0];
        if (!unique_genes.includes(gene)) {
            unique_genes.push(gene);
        }
    }

    if (storeTokens) {
        for (var i = 0; i < unique_genes.length; i++) {
            storeToken(unique_genes[i], "sge_selected_genes", "sge_gene_input");
        }
        for (var i = 0; i < data['cell_types'].length; i++) {
            storeToken(data['cell_types'][i], "sge_selected_celltypes", "sge_celltype_input");
        }
    }

    // Show error message and return if data input is invalid
    errMsg = validateInput(data);
    if (errMsg != undefined) {
        d3.select("#sge")
          .style("color", "purple")
          .text(errMsg);
        return;
    }

    var height = 700,
    width = 900,
    bottom_yMargin = 250,
    top_yMargin = 60,
    xMargin = 120,
    yVals = data['cell_types'],
    yMin = -1,
    xMin = -1,
    yMax = yVals.length - 1,
    xVals = data['gene_complex'],
    xMax= xVals.length - 1,
    mean_zscores = data['mean_zscores'],
    percents = data['percents'],
    min_zscore = data['min_zscore'],
    max_zscore = data['max_zscore'],
    cellType2Degs = data['celltype2degs'],
    colorDomain = yVals,
    legend_offset = 160;

  var svg = d3
    .select("#sge")
    .append("svg")
    .style("color", "black")
    .attr("class", "axis")
    .attr("width", width)
    .attr("height", height);

    // Insert title
    var title = "Mean expressions of genes per cell type";
    // The title in #sge_header div is used for naming of the PDF file when the plot is downloaded
    $("#sge_header").text(title);
    svg.append("text")
        .attr("x", - xMargin + width / 2)
        .attr("y", 20)
        .style("font-size", "16px")
        .attr("font-weight", 400)
        .attr("font-family", "Arial")
        .text(title);

  var yAxisLength = height - top_yMargin - bottom_yMargin,
      xAxisLength = width - xMargin - legend_offset;

  var xScale = d3
      .scaleLinear()
      .domain([xMin, xMax])
      .range([0, xAxisLength]),
      yScale = d3
      .scaleLinear()
      .domain([yMax, yMin])
      .range([0, yAxisLength]);

    // Make z-score colour legend symmetric
    const max_abs_zscore = Math.max(Math.abs(min_zscore), max_zscore);
    min_zscore = -1 * max_abs_zscore;
    max_zscore = max_abs_zscore;
    var colorscale = d3
      .scaleSequential()
      .domain([min_zscore, max_zscore])
      // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
      .interpolator(d3.piecewise(d3.interpolateRgb.gamma(2.2), ["blue", "#b5a7a7", "red"]));


  sgeRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale);
  sgeRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin);
  const legend_xPos=xAxisLength+legend_offset;
  const legend_yPos=top_yMargin+50;
  // cell types
  for (var i = 0; i <= yVals.length - 1; i++) {
    // genes
    for (var j = 0; j <= xVals.length - 1; j++) {
      var zscore = mean_zscores[j][i];
      var cellType = yVals[i];
      var gene = xVals[j]
      if (cellType2Degs) {
          deg = cellType2Degs[cellType] && cellType2Degs[cellType].includes(gene) ? true : false;
      } else {
          deg = false;
      }
      sgeRenderPoint(svg, j, i, zscore, percents, deg, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, legend_xPos - 30, -20);
    }
  }

  // Colour legend:
  // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
  // Band scale for x-axis
  const legend_width=50
  const legend_height=150
  domain=[min_zscore, max_zscore]
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
  [min_zscore, max_zscore] = paddedDomain;
  const expandedDomain = d3.range(min_zscore, max_zscore, (max_zscore - min_zscore) / legend_height);

  // Define the colour legend bar
  const svgBar = fc
    .autoBandwidth(fc.seriesSvgBar())
    .xScale(legend_xScale)
    .yScale(legend_yScale)
    .crossValue(0)
    .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : 0))
    .mainValue(d => d)
    .decorate(selection => {
      selection.selectAll("path").style("fill", d => colorscale(d));
    });

    // Add the colour legend header
    svg
    .append("text").attr("x", legend_xPos-12).attr("y", top_yMargin+10).text("Mean expression").style("font-size", "15px")
    .append('tspan').attr("x", legend_xPos-12).attr("y", top_yMargin+30).text("z-score")
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
//    .tickValues([...domain, 0, (domain[1] + domain[0]) / 2])
    .tickValues([...domain, 0])
    .tickSizeOuter(0);

  // Drawing and translating the label
  colourLegendBar.append("g")
    // .attr("transform", `translate(${barWidth})`)
    .attr("transform", "translate(" + 15 + ")")
    .datum(expandedDomain)
    .call(axisLabel)
    .select(".domain")
    .attr("visibility", "hidden");

  // DEG legend:
  if (cellType2Degs) {
      var deg_legend_yPos=legend_yPos+legend_height+30
      svg.append("circle").attr("cx",legend_xPos).attr("cy",deg_legend_yPos).attr("r", 8).style("fill", "#3DE397")
      svg.append("circle").attr("cx",legend_xPos).attr("cy",deg_legend_yPos).attr("r", 5).style("fill", "#FFFFFF")
      svg.append("text").attr("x", legend_xPos+20).attr("y", deg_legend_yPos).text("Is DEG").style("font-size", "15px").attr("alignment-baseline","middle")
  }

  var dotLegendHeight = 0;
  if (percents) {
      // Percents legend - dot size
      const dotlegend_xPos=width-315
      const dotlegend_yPos=top_yMargin+legend_height+10
      const dotLegendWidth = 450;
      dotLegendHeight = 330;
      const dotSizeLegend = svg
            .append("svg")
            .attr("width", dotLegendWidth)
            .attr("height", dotLegendHeight)
            .attr("x", dotlegend_xPos)
            .attr("y", dotlegend_yPos);

      // Dot size legend header
      const dotLegendXPos = legend_offset + 25;
      dotSizeLegend
       .append("text").attr("x", dotLegendXPos).attr("y", 110).text("Percent of cells").style("font-size", "15px")
        .attr("alignment-baseline","middle")
      dotSizeLegend
        .append("text").attr("x", dotLegendXPos).attr("y", 130).text("in cell type").style("font-size", "15px")
        .attr("alignment-baseline","middle")
      // dot size legend content
      dotSizeLegend.append("circle").attr("cx",dotLegendXPos).attr("cy",160).attr("r", 1).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",dotLegendXPos).attr("cy",190).attr("r", 2).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",dotLegendXPos).attr("cy",220).attr("r", 4).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",dotLegendXPos).attr("cy",250).attr("r", 6).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",dotLegendXPos).attr("cy",280).attr("r", 8).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",dotLegendXPos).attr("cy",310).attr("r", 10).style("fill", "#404080")
      dotSizeLegend.append("text").attr("x", dotLegendXPos + 35).attr("y", 160).text("(0, 0.2)").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", dotLegendXPos + 35).attr("y", 190).text("0.2").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", dotLegendXPos + 35).attr("y", 220).text("0.4").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", dotLegendXPos + 35).attr("y", 250).text("0.6").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", dotLegendXPos + 35).attr("y", 280).text("0.8").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", dotLegendXPos + 35).attr("y", 310).text("1").style("font-size", "15px").attr("alignment-baseline","middle")
  }
}

function sgeRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin) {
    var xAxis = d3
      .axisBottom()
      .ticks(xVals.length)
      .tickFormat(t => {
        return xVals[t];
      })
      .scale(xScale);
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("id", "sge_x-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + (height - bottom_yMargin) + ")";
      })
      .attr("opacity", 1)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    d3.selectAll("#sge_x-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", -(height - top_yMargin - bottom_yMargin))
  }

function sgeRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale) {
    var yAxis = d3
      .axisLeft()
      .ticks(yVals.length)
      .tickFormat(t => {
        return yVals[t];
      })
      .scale(yScale);
    svg
      .append("g")
      .attr("class", "y-axis")
      .attr("id", "sge_y-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + top_yMargin + ")";
      })
      .call(yAxis);

    d3.selectAll("#sge_y-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxisLength)
      .attr("y2", 0)
      .attr("fill", colorscale(0));
  }

function sgeRenderPoint(svg, j, i, zscore, percents, deg, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, tooltip_xPos, tooltip_yPos) {
    var innerRadius;
    // outerRadius is used for deg cell type-gene tuples only
    var outerRadius;
    var percent;
    if (percents) {
       percent = percents[j][i];
       innerRadius = percent*10;
    } else {
       // Just a place holder to give each point a visible size
       innerRadius = 3;
    }

    if (deg) {
      outerRadius = innerRadius + 3;
      svg
      .append("circle")
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr("cx", xScale(j))
        .attr("cy", yScale(i))
        .attr("fill", "#3DE397")
        .attr("r", outerRadius);
    }
    var cellType = yVals[i];
    var gene = xVals[j];
    var tooltipText = "Cell type: " + cellType + "<br>Gene: " + gene+ "<br>Z-score: " + zscore;
    if (percents) {
        tooltipText += "<br>Percent of cells: " + percent;
    }

    var tooltip = d3.select("#sge")
    .append("div")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "0px")
    .style("border-radius", "5px")
    .style("padding", "10px")
    .style("box-shadow", "2px 2px 20px")
    .style("opacity", "0.9")
    .attr("id", "sge_tooltip")
    .html(tooltipText);

    svg
      .append("circle")
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr("cx", xScale(j))
        .attr("cy", yScale(i))
        .attr("fill", colorscale(zscore))
        .attr("r", innerRadius)
        .on("mouseover", function(){tooltip.text; return tooltip.style("visibility", "visible");})
        .on("mousemove", function(event){return tooltip.style("top", tooltip_yPos+'px').style("left",tooltip_xPos +'px')})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden")});
    }

 // Filter data['num_ints'] based on the selected cell types
 function filterNumInteractions(data, cellTypes, isHeatmap) {
    numInteractions = data['num_ints'],
    ct2indx = data['ct2indx'];
    // Filter rows and columns of numInteractions by cellTypes
    // N.B. we don't recalculate min_ints, max_ints for filteredNumInteractions because
    // if we show one heatmap per microenvironment, we need colours comparable across all heatmaps
    var ctIndexes = cellTypes.map(ct => ct2indx[ct]);
    var filteredNumInteractions = [];
    for (let i = 0; i < numInteractions.length; i++) {
        if (ctIndexes.includes(i)) {
          var filteredRow = ctIndexes.map(idx => numInteractions[i][idx]);
          filteredNumInteractions.push(filteredRow);
        }
    }
    // Generate filtered data for chord plot
    var filteredNumInteractionsForChord = "source,target,value\n";
    for (let i = 0; i < filteredNumInteractions.length; i++) {
        const row = filteredNumInteractions[i];
        for (let j = 0; j < row.length; j++) {
              if (row[j] > 0) {
                  filteredNumInteractionsForChord +=
                      cellTypes[i] + "," + cellTypes[j] + "," + row[j] + "\n";
              }
        }
    }
    if (isHeatmap == true) {
        return filteredNumInteractions;
    } else {
        return filteredNumInteractionsForChord;
    }
 }

 function generateCellCellInteractionSummaryPlot(data, cellTypes, title, plotCnt) {
      var height = 600,
        width = 800,
        bottom_yMargin = 160,
        top_yMargin = 50,
        xMargin = 140,
        yVals = cellTypes,
        yMin = -1,
        xMin = -1,
        yMax = yVals.length - 1,
        xVals = cellTypes,
        xMax= xVals.length - 1,
        // total_min_ints, total_max_ints needed for color scale
        // N.B. We don't take parseInt(data['min_num_ints']) as min_ints because the bar legend misbehaves when min_ints > 0
        // and so far I've not been able to make it work with min_ints > 0
        min_ints=0,
        max_ints=parseInt(data['max_num_ints']),
        colorDomain = yVals,
        boxWidth = Math.round(380/yVals.length),
        legend_width=50
        legend_height=150,
        legend_xPos=width-220
        legend_yPos=top_yMargin+50,
        xAxisYOffset = -0.048*xVals.length + 2.8,
        yAxisYOffset = -0.054*yVals.length + 2.59,
        tooltipXPos = legend_xPos;
        tooltipYPos = legend_yPos+240;

      if (plotCnt > 0) {
        $("#cci_summary_show_all_celltypes_div").show();
        enable_cci_summary_show_all_celltypes();

        // We're dealing with multiple plots - one per microenvironment
        height = 300,
        width = 400,
        boxWidth = Math.round(95/yVals.length),
        legend_width=30,
        legend_height=100,
        legend_xPos=width-140,
        legend_yPos=top_yMargin+50;
        xMargin = 140,
        xAxisYOffset = Math.max(-0.4*xVals.length + 3.3, -0.4*6 + 3.3),
        yAxisYOffset = Math.max(-0.5*yVals.length + 3.6, -0.5*6 + 3.6),
        tooltipXPos = legend_xPos,
        tooltipYPos = legend_yPos+180;
      }
      filteredNumInteractions = filterNumInteractions(data, cellTypes, true);

      $("#cci"+plotCnt + "_div").show();
      // This (hidden) field is used for naming the PDF file when the plot is downloaded
      $("#cci"+plotCnt + "_header").text(title);

      var svg = d3
        .select("#cci" + plotCnt)
        .append("svg")
        .attr("class", "axis")
        .attr("width", width)
        .attr("height", height);

      // Insert title
      svg.append("text")
        .attr("x", - xMargin + width / 2)
        .attr("y", 20)
        .style("font-size", "16px")
        .attr("font-weight", 400)
        .attr("font-family", "Arial")
        .text(title)

      var yAxisLength = height - top_yMargin - bottom_yMargin,
          xAxisLength = yAxisLength;

      var xScale = d3
          .scaleLinear()
          .domain([xMin, xMax])
          .range([0, xAxisLength]),
        yScale = d3
          .scaleLinear()
          .domain([yMax, yMin])
          .range([0, yAxisLength]),
        colorscale = d3
          .scaleSequential()
          .domain([max_ints, min_ints])
          // See: https://observablehq.com/@d3/sequential-scales
          .interpolator(d3.interpolateRdYlBu)

      cciRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, colorscale, yAxisYOffset);
      cciRenderXAxis(svg, xVals, xScale, xMargin, height, bottom_yMargin, xAxisYOffset);
      // cellType1
      for (var i = 0; i <= yVals.length - 1; i++) {
        // cellType2
        for (var j = 0; j <= xVals.length - 1; j++) {
          var num_ints = filteredNumInteractions[j][i];
          var cellType1 = yVals[i];
          var cellType2 = xVals[j];
          cciRenderRectangle(svg, j, i, yVals, xMargin, top_yMargin, xVals, xScale, yScale, colorscale, num_ints, plotCnt, tooltipXPos, tooltipYPos, boxWidth);
        }
      }

      // Colour legend:
      // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
      // Band scale for x-axis
      domain=[min_ints, max_ints]
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
        .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : 0))
        .mainValue(d => d)
        .decorate(selection => {
          selection.selectAll("path").style("fill", d => colorscale(d));
        });

        // Add the colour legend header
        svg
        .append("text").attr("x", legend_xPos-12).attr("y", top_yMargin+10).text("Number of").style("font-size", "15px")
        .append('tspan').attr("x", legend_xPos-12).attr("y", top_yMargin+30).text("interactions")
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
 }

function cciRenderXAxis(svg, xVals, xScale, xMargin, height, bottom_yMargin, xAxisYOffset) {
  var xAxis = d3
  .axisBottom()
  .ticks(xVals.length)
  .tickFormat(t => {
    return xVals[t];
  })
  .scale(xScale);
  svg
  .append("g")
  .attr("class", "x-axis")
  .attr("transform", function() {
    return "translate(" + xMargin + "," + (height - bottom_yMargin) + ")";
  })
  .attr("opacity", 1)
  .call(xAxis)
  .selectAll("text")
  .style("text-anchor", "end")
  .attr("dx", "-0.8em")
  .attr("dy", "-" + xAxisYOffset + "em")
  .attr("transform", "rotate(-90)");
}

function cciRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, colorscale, yAxisYOffset) {
  var yAxis = d3
  .axisLeft()
  .ticks(yVals.length)
  .tickFormat(t => {
    return yVals[t];
  })
  .scale(yScale);
  svg
  .append("g")
  .attr("class", "y-axis")
  .attr("transform", function() {
    return "translate(" + xMargin + "," + top_yMargin + ")";
  })
  .call(yAxis)
  .selectAll("text")
  .style("text-anchor", "end")
  .attr("dx", "-0.15em")
  .attr("dy", yAxisYOffset + "em");
}

function cciRenderRectangle(svg, x, y, yVals, xMargin, top_yMargin, xVals, xScale, yScale, colorscale, num_ints, plotCnt, tooltip_xPos, tooltip_yPos, boxWidth) {
    // Assumption: yVals.length == xVals.length
    var boxHeight = boxWidth;
    var cellType1 = yVals[y];
    var cellType2 = xVals[x];
    var tooltip = d3.select("#cci" + plotCnt)
        .append("div")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "0px")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("box-shadow", "2px 2px 20px")
        .style("opacity", "0.9")
        .attr("id", "cci" + plotCnt + "_tooltip")
        .html("Number of interactions<br>between " + cellType1 + " and " + cellType2 + ": " + num_ints);

    svg.append('rect')
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr('x', xScale(x) - boxWidth)
        .attr('y', yScale(y))
        .attr('width', boxWidth)
        .attr('height', boxHeight)
        .attr("fill", colorscale(num_ints))
        .attr('stroke', 'transparent')
        .on("mouseover", function(){tooltip.text; return tooltip.style("visibility", "visible");})
        .on("mousemove", function(event){return tooltip.style("top", tooltip_yPos+'px').style("left",tooltip_xPos +'px')})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden")});
}

function clearSGEFilters() {
    $('.sge_selected_genes').empty();
    $('.sge_selected_celltypes').empty();
}

function clearCCISearchFilters() {
    $('.cci_search_selected_genes').empty();
    $('.cci_search_selected_celltypes').empty();
    $('.cci_search_selected_interactions').empty();
    $('.cci_search_selected_celltype_pairs').empty();
}

function getPValBucket(pVal) {
    var ret;
    if (!pVal) {
        pVal = 1;
    }
    if (pVal > 0) {
        ret = Math.min(Math.round(Math.abs(Math.log10(pVal))), 3)
    } else {
        ret = 3
    }
    return ret;
}

function generateCellCellInteractionSearchPlot(data, storeTokens, showZScores) {
    // DEBUG console.log(data);
    $("#cci_search").empty();
    const selectedGenes = data['selected_genes'];
    const selectedInteractingPairs = data['selected_interacting_pairs'];
    const selectedCellTypes = data['selected_cell_types'];
    const selectedCellTypePairs = data['selected_cell_type_pairs'];
    const selectedCTP2Me = data['selected_cell_type_pairs2microenvironment'];
    const microenvironments = data['microenvironments']
    const cellsign_active_interactions = data['cellsign_active_interactions']

    // See: https://observablehq.com/@d3/color-schemes
    const colours = d3.schemeCategory10;
    var me2Colour = {};
    var mes = Array.from(new Set(Object.values(selectedCTP2Me)));
    for (var i = 0; i < mes.length; i++) {
      const me = mes[i];
      if (me === "all") {
        // No micro-environments are specified in the config
        me2Colour[me] = "black";
      } else {
        me2Colour[me] = colours[i % colours.length];
      }
    }

    var mes4Legend = [];
    var ctp2Colour = {}
    for (var i = 0; i < selectedCellTypePairs.length; i++) {
      const ctp = selectedCellTypePairs[i];
      const me = selectedCTP2Me[ctp];
      ctp2Colour[ctp] = me2Colour[me];
      if (!mes4Legend.includes(me)) {
        // We need mes4Legend to be in the same order as the groups of cell type pairs on the x-axis
        mes4Legend.push(me);
      }
    }

    if (storeTokens) {
        for (var i = 0; i < selectedGenes.length; i++) {
            storeToken(selectedGenes[i], "cci_search_selected_genes", "cci_search_gene_input");
        }
        for (var i = 0; i < selectedCellTypes.length; i++) {
            storeToken(selectedCellTypes[i], "cci_search_selected_celltypes", "cci_search_celltype_input");
        }
        for (var i = 0; i < selectedInteractingPairs.length; i++) {
            storeToken(selectedInteractingPairs[i], "cci_search_selected_interactions", "cci_search_interaction_input");
        }
        for (var i = 0; i < selectedCellTypePairs.length; i++) {
            storeToken(selectedCellTypePairs[i], "cci_search_selected_celltype_pairs", "cci_search_celltype_pair_input");
        }
    }

    if (!data.hasOwnProperty('interacting_pairs_means')) {
        d3.select("#cci_search")
        .style("color", "purple")
        .text('No significant interactions were found - please try another search.');
        return
    }

    // Needed for calculating the left margin
    var longest_ip_label = data['interacting_pairs_means'].sort(
        function (a, b) {
            return b.length - a.length;
        })[0];

    var height = 700,
    width = 1400,
    bottom_yMargin = 180,
    top_yMargin = 60,
    xMargin = longest_ip_label.length * 7.3,
    yVals = data['interacting_pairs_means'],
    yMin = -1,
    xMin = -1,
    yMax = yVals.length - 1,
    xVals = data['cell_type_pairs_means'],
    xMax= xVals.length - 1,
    mean_values = data['values'],
    pvalues=data['filtered_pvalues'],
    relevant_interactions=data['filtered_relevant_interactions'],
    colorDomain = yVals;

  // min_value, max_value needed for color scale
  max_val=data['max_value'];
  if (showZScores) {
      min_val = data['min_value'];
  } else {
      // N.B. We don't take data['min_value'] as min_value because the bar legend misbehaves when min_expr > 0
      // and so far I've not been able to make it work with min_expr > 0
      min_val = 0;
  }

  var svg = d3
    .select("#cci_search")
    .style("color", "black")
    .append("svg")
    .attr("class", "axis")
    .attr("width", width)
    .attr("height", height);

    // Insert title
    var title = "Significant interactions per cell type pair";
    // The title in #cci_search_header div is used for naming of the PDF file when the plot is downloaded
    $("#cci_search_header").text(title);
    svg.append("text")
        .attr("x", - xMargin + width / 2)
        .attr("y", 20)
        .style("font-size", "16px")
        .attr("font-weight", 400)
        .attr("font-family", "Arial")
        .text(title);

  var yAxisLength = height - top_yMargin - bottom_yMargin,
      xAxisLength = width - xMargin - 350;

  var xScale = d3
      .scaleLinear()
      .domain([xMin, xMax])
      .range([0, xAxisLength]),
      yScale = d3
      .scaleLinear()
      .domain([yMax, yMin])
      .range([0, yAxisLength]);
  var  colorscale;
  if (showZScores) {
       // Make z-score colour legend symmetric
       const max_abs_zscore = Math.max(Math.abs(min_val), max_val);
       min_val = -1 * max_abs_zscore;
       max_val = max_abs_zscore;
       colorscale = d3
          .scaleSequential()
          .domain([min_val, max_val])
          // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
          .interpolator(d3.piecewise(d3.interpolateRgb.gamma(2.2), ["blue", "#b5a7a7", "red"]));
  } else {
       colorscale = d3
          .scaleSequential()
          .domain([min_val, max_val])
          // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
          .interpolator(d3.piecewise(d3.interpolateRgb.gamma(2.2), ["black", "blue", "yellow", "red"]));
  }

  cciSearchRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale);
  cciSearchRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin, ctp2Colour);
  const barLegend_xPos=width-300;
  const barLegend_yPos=top_yMargin+30;
  var activeInteractionInfo;
  // interacting pairs
  for (var i = 0; i <= yVals.length - 1; i++) {
    // cell type pairs
    for (var j = 0; j <= xVals.length - 1; j++) {

      var value = mean_values[i][j];
      var pValue;
      if (pvalues) {
         pValue = pvalues[i][j];
      }
      var relIntFlag;
      if (relevant_interactions) {
         relIntFlag = relevant_interactions[i][j];
      }
      var cellTypePair = data['cell_type_pairs_means'][j];
      var interaction = data['interacting_pairs_means'][i];
      activeInteractionInfo = undefined;
      if (cellsign_active_interactions != undefined &&
          cellsign_active_interactions[interaction] != undefined &&
          cellsign_active_interactions[interaction].hasOwnProperty(cellTypePair)) {
            activeInteractionInfo = cellsign_active_interactions[interaction][cellTypePair];
      }
      cciSearchRenderPoint(svg, j, i, value, pValue, relIntFlag, cellTypePair, interaction, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, barLegend_xPos-80, -20, pvalues, showZScores, activeInteractionInfo);
    }
  }

  // value (=mean expression or z-score) heatmap colour legend:
  // See: https://blog.scottlogic.com/2019/03/13/how-to-create-a-continuous-colour-range-legend-using-d3-and-d3fc.html
  // Band scale for x-axis
  const barLegendWidth=50
  const barLegendHeight=150
  domain=[min_val, max_val]

  const legend_xScale = d3
    .scaleBand()
    .domain([0, 1])
    .range([0, barLegendWidth]);

  // Linear scale for y-axis
  const legend_yScale = d3
    .scaleLinear()
    .domain(domain)
    .range([barLegendHeight, 0]);

  // An array interpolated over our domain where height is the height of the bar
  // Padding the domain by 3%
  // This will have an effect of the bar being 3% longer than the axis label
  // (otherwise top/bottom figures on the legend axis would be cut in half)
  const paddedDomain = fc.extentLinear()
    .pad([0.03, 0.03])
    .padUnit("percent")(domain);
  [min_val, max_val] = paddedDomain;
  const expandedDomain = d3.range(min_val, max_val, (max_val - min_val) / barLegendHeight);

  // Define the colour legend bar
  const svgBar = fc
    .autoBandwidth(fc.seriesSvgBar())
    .xScale(legend_xScale)
    .yScale(legend_yScale)
    .crossValue(0)
    .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : 0))
    .mainValue(d => d)
    .decorate(selection => {
      selection.selectAll("path").style("fill", d => colorscale(d));
    });

    // Add the colour legend header
    var legendLabel = "Mean expression";
    if (showZScores) {
        legendLabel += " z-score";
    }
    svg
    .append("text").attr("x", barLegend_xPos-12).attr("y", top_yMargin+10).text(legendLabel).style("font-size", "15px")
//    .append('tspan').attr("x", barLegend_xPos-12).attr("y", top_yMargin+30).text("z-score")
    .attr("alignment-baseline","middle");

  // Draw the legend bar
  const colourLegendBar = svg
    .append("g")
    .attr("transform", function() {
        return "translate(" + barLegend_xPos + "," + barLegend_yPos + ")";
      })
    .datum(expandedDomain)
    .call(svgBar);

  // Linear scale for legend label
  const legendLabel_yScale = d3
    .scaleLinear()
    .domain(paddedDomain)
    .range([barLegendHeight, 0]);

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

  var cellsign_active_interactions_legend_height = 0;
  if (cellsign_active_interactions) {
      cellsign_active_interactions_legend_height = 20;
      const cellsign_ai_legend_yPos=top_yMargin+barLegendHeight+70;
      const cellsign_ai_legend_xPos = width-300;
      svg.append("circle").attr("cx",cellsign_ai_legend_xPos).attr("cy",cellsign_ai_legend_yPos).attr("r", 8).style("fill", "#3DE397")
      svg.append("circle").attr("cx",cellsign_ai_legend_xPos).attr("cy",cellsign_ai_legend_yPos).attr("r", 5).style("fill", "#FFFFFF")
      svg.append("text").attr("x", cellsign_ai_legend_xPos+20).attr("y", cellsign_ai_legend_yPos).text("Is active interaction").style("font-size", "15px").attr("alignment-baseline","middle")
  }

  var dotLegendHeight = 0;
  if (pvalues) {
      // P-Value legend - dot size
      const dotlegend_xPos=width-315
      const dotlegend_yPos=top_yMargin+barLegendHeight+cellsign_active_interactions_legend_height+20;
      const dotLegendWidth = 450;
      dotLegendHeight = 300;
      const dotSizeLegend = svg
            .append("svg")
            .attr("width", dotLegendWidth)
            .attr("height", dotLegendHeight)
            .attr("x", dotlegend_xPos)
            .attr("y", dotlegend_yPos);

      // Dot size legend header
      dotSizeLegend
        .append("text").attr("x", 5).attr("y", 80).text("-log").style("font-size", "15px")
        .append('tspan').text('10').style('font-size', '.7rem').attr('dx', '.1em').attr('dy', '.9em')
        .append('tspan').text("P").style("font-size", "15px").attr('dx', '-.1em').attr('dy', '-.9em')
        .attr("alignment-baseline","middle")
      // dot size legend content
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",110).attr("r", 2).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",140).attr("r", 4).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",170).attr("r", 6).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",200).attr("r", 8).style("fill", "#404080")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 110).text("0").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 140).text("1").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 170).text("2").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", 35).attr("y", 200).text(">=3").style("font-size", "15px").attr("alignment-baseline","middle")
  } else if (relevant_interactions) {
      // Relevant interactions legend - (static larger) dot size
      const dotlegend_xPos=width-315
      const dotlegend_yPos=top_yMargin+barLegendHeight+cellsign_active_interactions_legend_height+20
      const dotLegendWidth = 450;
      dotLegendHeight = 150;
      const dotSizeLegend = svg
            .append("svg")
            .attr("width", dotLegendWidth)
            .attr("height", dotLegendHeight)
            .attr("x", dotlegend_xPos)
            .attr("y", dotlegend_yPos);

      // dot size legend content
      dotSizeLegend.append("circle").attr("cx",15).attr("cy",60).attr("r", 8).style("fill", "#404080");
      dotSizeLegend.append("text").attr("x", 35).attr("y", 60).text("Is relevant interaction").style("font-size", "15px").attr("alignment-baseline","middle")
  }
  
  if (microenvironments) {
      // Legend for cell type pair colours - by micro-environment
      const meLegend_xPos=width-315;
      var meLegend_yPos;

      if (pvalues || relevant_interactions) {
        meLegend_yPos=top_yMargin+barLegendHeight+dotLegendHeight+cellsign_active_interactions_legend_height-110;
      } else {
        meLegend_yPos=top_yMargin+barLegendHeight+10;
      }

      const meLegenedWidth = 450;
      const meLegendHeight = 300;
      const meLegend = svg
            .append("svg")
            .attr("width", meLegenedWidth)
            .attr("height", meLegendHeight)
            .attr("x", meLegend_xPos)
            .attr("y", meLegend_yPos);

      // Microenvironments legend header
      meLegend
        .append("text").attr("x", 5).attr("y", 80).text("Microenvironments").style("font-size", "15px")
        .attr("alignment-baseline","middle")

      // Microenvironments legend content
      const size = 12;
      const meLegendStartYPos = 100;
      var meLegendYPos = meLegendStartYPos;
      for (var i = 0; i <= mes4Legend.length - 1; i++) {
          var me = mes4Legend[i];
          var colour = me2Colour[me];
          meLegend.append("rect").attr("x",15).attr("y",meLegendYPos).attr("width", size).attr("height", size).style("fill", colour)
          meLegend.append("text").attr("x", 35).attr("y", meLegendYPos+6).text(me).style("font-size", "15px").attr("alignment-baseline","middle");
          meLegendYPos += 30;
      }
  }
}

function cciSearchRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin, ctp2Colour) {
    var xAxis = d3
      .axisBottom()
      .ticks(xVals.length)
      .tickFormat(t => {
        return xVals[t];
      })
      .scale(xScale);
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("id", "cci_search_x-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + (height - bottom_yMargin) + ")";
      })
      .attr("opacity", 1)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)");

    d3.selectAll("#cci_search_x-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", -(height - top_yMargin - bottom_yMargin))

    // Colour cell type pairs in different colour per microenvironment
    d3.selectAll("#cci_search_x-axis g.tick").each(function() {
        d3.select(this).select("text").style("fill", function() {
            var cell_type_pair = this.textContent;
            return ctp2Colour[cell_type_pair];
        })
    })
}

function cciSearchRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale) {
    var yAxis = d3
      .axisLeft()
      .ticks(yVals.length)
      .tickFormat(t => {
        return yVals[t];
      })
      .scale(yScale);
    svg
      .append("g")
      .attr("class", "y-axis")
      .attr("id", "cci_search_y-axis")
      .attr("transform", function() {
        return "translate(" + xMargin + "," + top_yMargin + ")";
      })
      .call(yAxis);

    d3.selectAll("#cci_search_y-axis g.tick")
      .append("line")
      .classed("grid-line", true)
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", xAxisLength)
      .attr("y2", 0)
      .attr("fill", colorscale(0));
}

function cciSearchRenderPoint(svg, j, i, value, pValue, relIntFlag, cellTypePair, interaction, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, tooltip_xPos, tooltip_yPos, pvalues, showZScores, activeInteractionInfo) {
    var radius;
    var pvalBucket;
    if (pvalues) {
        pvalBucket = getPValBucket(pValue);
        radius = pvalBucket * 2 + 2;
    } else if (relIntFlag) {
        radius = 8;
    } else {
        radius = 2;
    }
    var valLabel = "Expression";
    if (showZScores) {
       valLabel = "Z-score";
    }
    var tooltipContent = "Interaction: " + interaction + "<br>Cell type pair: " + cellTypePair + "<br>" + valLabel + ": " + value;
    if (pvalues) {
        tooltipContent += "<br>Nominal P-value: " + pValue;
        tooltipContent += "<br>-log10pvalue bucket: ";
        if (pvalBucket == 3) {
            tooltipContent += ">=";
        }
        tooltipContent += pvalBucket;
    } else if (relIntFlag) {
        tooltipContent = "<b>Relevant</b> " + tooltipContent;
    }
    // Assemble in activeTFsCellTypesStr and add to tooltipContent information about all active TFs/active cell types
    if (activeInteractionInfo != undefined) {
        var activeTFsCellTypesStr = "";
        for (var k = 0; k < activeInteractionInfo.length; k++) {
            if (activeTFsCellTypesStr.length > 0) {
                activeTFsCellTypesStr += "; ";
            }
            activeTFsCellTypesStr += activeInteractionInfo[k].join(" - ");
        }
        if (activeTFsCellTypesStr.length > 0) {
            tooltipContent += "<br>Active TFs/Cell Types: " + activeTFsCellTypesStr;
        }
    }
    var cellType = yVals[i];
    var gene = xVals[j];
    var tooltip = d3.select("#cci_search")
    .append("div")
    .style("position", "absolute")
    .style("visibility", "hidden")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "0px")
    .style("border-radius", "5px")
    .style("padding", "10px")
    .style("box-shadow", "2px 2px 20px")
    .style("opacity", "0.9")
    .attr("id", "cci_search_tooltip")
    .html(tooltipContent);

    if (activeInteractionInfo != undefined) {
      outerRadius = radius + 3;
      svg
      .append("circle")
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr("cx", xScale(j))
        .attr("cy", yScale(i))
        .attr("fill", "#3DE397")
        .attr("r", outerRadius);
    }

    svg
      .append("circle")
        .attr("transform", function() {
          return "translate(" + xMargin + "," + top_yMargin + ")";
        })
        .attr("cx", xScale(j))
        .attr("cy", yScale(i))
        .attr("fill", colorscale(value))
        .attr("r", radius)
        .on("mouseover", function(){tooltip.text; return tooltip.style("visibility", "visible");})
        .on("mousemove", function(event){return tooltip.style("top", tooltip_yPos+'px').style("left",tooltip_xPos +'px')})
        .on("mouseout", function(){return tooltip.style("visibility", "hidden")});
}

function refreshCCISearchPlot(showZScores) {
    var projectId = $("#project_id").text();
    var ret = getSelectedTokens([
        "cci_search_selected_genes", "cci_search_selected_celltypes",
        "cci_search_selected_celltype_pairs", "cci_search_selected_interactions"]);
    var selectedGenes = ret[0];
    var selectedCellTypes = ret[1];
    var selectedCellTypePairs = ret[2];
    var selectedInteractions = ret[3];
    // DEBUG console.log(selectedGenes, selectedCellTypes, selectedCellTypePairs, selectedInteractions);
    var url = '/api/data/'+projectId+'/cell_cell_interaction_search';
    if (selectedGenes || selectedCellTypes || selectedInteractions || selectedCellTypePairs) {
        url += "?";
        if (selectedGenes) {
            url += "genes=" + selectedGenes + "&";
        }
        if (selectedInteractions) {
            url += "interacting_pairs=" + selectedInteractions + "&";
        }
        if (selectedCellTypes) {
            url += "cell_types=" + selectedCellTypes + "&";
        }
        if (selectedCellTypePairs) {
            url += "cell_type_pairs=" + selectedCellTypePairs + "&";
        }
    } else {
        url += "?";
    }
    // In refresh mode, we don't pre-select interactions/cell type pairs - if the user did not enter any selections
    url += "refresh_plot=True";
    if (showZScores) {
        url += "&show_zscores=True";
    }
    $.ajax({
            url: url,
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                generateCellCellInteractionSearchPlot(res, storeTokens=false, showZScores=showZScores);
            }
     });
}