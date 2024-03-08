document.addEventListener('DOMContentLoaded', function() {

   // NB. anatomogram_labels is used for testing anatomograms only
   const anatomogram_labels = ["UBERON_0001013","UBERON_0000948","UBERON_0001135","UBERON_0000955","UBERON_0000029","UBERON_0001134","UBERON_0001044","UBERON_0003889","UBERON_0000995",
    "UBERON_0001021"
    ,"UBERON_0000977","UBERON_0003126",
    "UBERON_0002048","UBERON_0000341","UBERON_0001052","UBERON_0001706","UBERON_0001728","UBERON_0000167","UBERON_0001723","UBERON_0002372",
    "UBERON_0000970","UBERON_0000966","UBERON_0002037","UBERON_0002245","UBERON_0000451","UBERON_0001870","UBERON_0000004","UBERON_0001871",
    "UBERON_0000956","UBERON_0001876","UBERON_0002113","UBERON_0001225","UBERON_0001621","UBERON_0001736","UBERON_0002134","UBERON_0002046","UBERON_0000014"];    // TODO: Highlight in anatomogram EFO id that corresponds to the position of this.textContent in yVals


  // Show progress spinners
  $("#sge_spinner").show();
  $("#cci_summary_spinner").show();

  var hash = getHash();
  var projectId = getProjectId();
  // Redirect to error page if no project id was provided
  if (!projectId) {
      window.location.href = "error.html?msg="+encodeURIComponent("Error: Please provide project identifier, e.g. index.html?projectid=myprojectid");
  } else {
      // Redirect to error page if projectid is invalid
      const validate_projectid = async () => {
         const response = await fetch('./api/validate/' + projectId);
         const json = await response.json();
         if (!json) {
            window.location.href = "error.html?msg="+encodeURIComponent("Sorry, project '" + projectId + "' does not exist.");
         }
      }
      validate_projectid();
  }

  // Redirect to error page if project is restricted access and no or incorrect auth hash was provided
  const validate_auth = async () => {
     const response = await fetch('./api/validate/auth/' + projectId + '?auth=' + hash);
     const json = await response.json();
     if (!json) {
        window.location.href = "error.html?msg="+encodeURIComponent("Sorry, you don't have access to this page.");
     }
  }
  validate_auth();

  // Effect smooth transition to a local tag on page
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const attr = this.getAttribute('href');
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
  });

  // Enable sliders
  var elems = document.querySelectorAll("input[type=range]");
  M.Range.init(elems);
  // Show min interaction score selection below the cci_summary_score_input slider
  document.querySelector('#cci_summary_score_input').addEventListener("input", (event) => {
        $('#cci_summary_selected_min_score').text(event.target.value);
  });

  // Enable dropdowns
  var options = {constrainWidth: false};
  var elems = document.querySelectorAll('.dropdown-trigger');
  var instances = M.Dropdown.init(elems, options);

  // Enable tooltips
  elems = document.querySelectorAll('.tooltipped');
  options = {};
  instances = M.Tooltip.init(elems, options);

  // Enable collapsible
  elems = document.querySelectorAll('.collapsible');
  options = {};
  instances = M.Collapsible.init(elems, options);



   // Populate page title
   $.ajax({
            url: './api/list',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                $("#page_header").text(res[projectId]);
                $("#page_title").text(res[projectId]);
            }
    });

    // Generate cell type composition plot
    $.ajax({
        url: './api/data/'+projectId+'/celltype_composition',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
          generateCellCompositionPlot(res);

          // Populate anatomogram
          if (!res.hasOwnProperty('all_elems')) {
                $("#ctcomp").append(res['anatomogram']);
                var elem = $("#ctcomp svg").attr("width", 300).attr("height", 500);
                // Highlight all anatomogram labels in light gray: #dadada
                for (var i = 0; i < anatomogram_labels.length; i++) {
                    const anatomogram_label = anatomogram_labels[i];
                    var elem = $('#ctcomp svg #LAYER_EFO #' + anatomogram_label + ' path').css({ fill: '#dadada' });
                }
          }
        }
    });

    // Generate spatial micro-environments plot
    $.ajax({
            url: './api/data/'+projectId+'/microenvironments',
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                generateMicroenvironmentsPlot(res, anatomogram_labels);
            }
    });

    // Generate single gene expression plot
    $.ajax({
        url: './api/data/'+projectId+'/single_gene_expression',
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

//            // TODO: This is a placeholder for a possible functionality where events can be triggered by
//            // a mouse hover over specific area of anatomogram
//            d3.selectAll("#ctcomp svg #LAYER_EFO #UBERON_0001013")
//            .on("mousemove", function(event) {
//                // Display element title
//                // See: https://developer.mozilla.org/en-US/docs/Web/API/Element
//                var parentNodesChildren = event.srcElement.parentNode.children;
//                var title;
//                for (var i = 0; i < parentNodesChildren.length; i++) {
//                    var child = parentNodesChildren[i];
//                    if (child.tagName == "title") {
//                        title = child.innerHTML;
//                        break;
//                    }
//                }
//                console.log(title);
//            })
//            .on("mouseout", function(){});

            // Hide progress spinner
            $("#sge_spinner").hide();
        }
     });

    // Generate 'CCI Specificity at a glance' plot on first page load
    $.ajax({
        url: './api/data/'+projectId+'/cell_cell_interaction_specificity_ataglance',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
          refreshCCISpecificityAtAGlancePlot(res);
        }
    });


     // Generate CCISummary plots on first page load
     refreshCCISummaryPlots();

     // Generate cell-cell interaction search plot
     $.ajax({
        url: './api/data/'+projectId+'/cell_cell_interaction_search',
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
            generateCellCellInteractionSearchPlot(res, storeTokens=true);
            // Populate num_all_cell_type_pairs div with the total number of cell type pairs in the experiment - the value in that
            // field will be used to warn the user that if they select all cell type pairs and all relevant interacting pairs
            // their browser run out of memory and crash.
            $('#num_all_cell_type_pairs').text(res['num_all_cell_type_pairs']);
            // Enable gene and cell type input autocompletes for gene expression plot
            enable_autocomplete('cci_search_celltype_input', 'cci_search_selected_celltypes', res['all_cell_types']);
            enable_autocomplete('cci_search_celltype_pair_input', 'cci_search_selected_celltype_pairs', res['all_cell_type_pairs']);
            enable_autocomplete('cci_search_gene_input', 'cci_search_selected_genes', res['all_genes']);
            enable_autocomplete('cci_search_interaction_input', 'cci_search_selected_interactions', res['all_interacting_pairs']);
            if (res.hasOwnProperty('microenvironments')) {
                enable_autocomplete('cci_search_microenvironment_input', 'cci_search_selected_microenvironments', res['microenvironments']);
                // Initialise 'Filter cell types by micro-environment in 'cell-cell interaction search' plot select dropdown
                enable_me2ct_select(res['microenvironment2cell_types'], res['all_cell_types'],
                                        'cci_search_selected_microenvironments','cci_search_selected_celltypes', 'cci_search_celltype_input');
                // Populate placeholder to show the user available microenvironments
                $("#cci_search_microenvironment_input")
                    .attr("placeholder",res['microenvironments'].toString());
            }
            if (res['all_cell_types'].length > 50) {
                // If we have a v.large number of cell types (and thus cell type pairs) don't allow the user to select all cell types in cci_dsearch plot
                $('#cci_search_select_all_celltypes').addClass('disabled');
            }
            // Allow the user to switch between mean expressions and z-scores being shown in the plot
            enable_cci_search_radio();
            // Allow the user to sort interacting pair either by the highest mean on top or alphabetically
            enable_cci_search_sort_ips_switch();
            // Enable side navs - used for displaying interacting pair participant information
            enable_side_navs();
            $("#cci_search_spinner").hide();
            if (res.hasOwnProperty('all_classes')) {
                 enable_autocomplete('cci_search_class_input', 'cci_search_selected_classes', res['all_classes']);
                 // Populate placeholder to show the user available classes of interacting pairs
                 $("#cci_search_class_input")
                     .attr("placeholder",res['all_classes'].toString());
                 $("#cci_search_class_filter_div").show();
            }
            if (res.hasOwnProperty('interaction_scores')) {
                // Don't allow the user to select the scores radio button unless interaction_scores were provided in config
                $("#rb_scores").show();
            }
        }
      });
});

function downloadAsPDF(divId, titleId, headerId) {
    var projectId = getProjectId();
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
         options['size'] = [svgWidth * 1.4, svgHeight * 1.9];
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

function enable_cci_search_radio() {
    $('input[name=cci_search_radio]').on('change', function() {
        $("#cci_search_spinner").show();
        refreshCCISearchPlot();
      });
}

function enable_cci_search_sort_ips_switch() {
    $('#cci_search_sort_ips_switch').on('change', function() {
        refreshCCISearchPlot();
      });
}

function enable_side_navs() {
    const options = {};
    var elems = document.querySelectorAll('.sidenav');
    var instances = M.Sidenav.init(elems, options);
}

function enable_cci_summary_switch(num_cell_types) {
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
            if (selected_microenvironments_div == 'sge_selected_microenvironments') {
               selected_cell_types = all_cell_types;
               $('.sge_selected_celltypes').show();
               $('#sge_celltype_input').prop( "disabled", false );
               $('#sge_select_all_celltypes').removeClass('disabled');
            } else if (selected_microenvironments_div == 'cci_search_selected_microenvironments') {
              if (maxCellTypesExceeded(all_cell_types)) {
                // Don't select all cell types for v. large datasets
                selected_cell_types = []
              } else {
                selected_cell_types = all_cell_types;
              }
              $('#cci_search_celltype_input').prop( "disabled", false );
              $('#cci_search_celltype_pair_input').prop( "disabled", false );
              $('.cci_search_selected_celltypes').show();
              $('#sge_select_all_celltypes').prop( "disabled", false );
              $('#cci_search_select_all_celltypes').removeClass('disabled');
            }
        }
        // Replace any previously selected cell types in selected_celltypes_div with the ones in the selected microenvironments
        // We're effectively forcing the user to select either cell types or microenvironments, but not both.
        $('.'+ selected_celltypes_div).empty();
        for (var i = 0; i < selected_cell_types.length; i++) {
            storeToken(selected_cell_types[i], selected_celltypes_div, celltype_input_div);
        }
    });
}

function selectAllCellTypes(viz){
    var projectId = getProjectId();
    var url = './api/data/'+projectId+'/' + viz;
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
            if (val.match(/\*$/)) {
                // If val is a pseudo-regex string (e.g. WNT*), expand it into all matching gene names
                regex = new RegExp(val.replace('*','.*'), 'g');
                regex_filtered_vals = vals.join('\n').match(regex);
                regex_filtered_vals.forEach( e => { if (!e.match(/\*$/)) { storeToken(e, target_div_class, input_field_id) }});
            } else {
                storeToken(val, target_div_class, input_field_id)
            }
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
            selectedTokens[i] = encodeURIComponent(vals).split(",");
        }
    }
    return selectedTokens;
}

function refreshSGEPlot() {
    var projectId = getProjectId();
    var ret = getSelectedTokens(["sge_selected_genes", "sge_selected_celltypes"]);
    var selectedGenes = ret[0];
    var selectedCellTypes = ret[1];
    var url = './api/data/'+projectId+'/single_gene_expression';
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
     // TODO: This code is just for testing of anatomogram functionality
     if (!data.hasOwnProperty('all_elems') && data.hasOwnProperty('anatomogram')) {
        // Don't hide #ctcomp - it is needed for anatomogram test
        return;
     }

     if (!data.hasOwnProperty('all_elems')) {
        // N.B. 'all_elems' is set only if celltype_composition is set in config
        $("#ctcomp_title").hide();
        $("#ctcomp").hide();
        $("#ctcomp_save_button").hide();
        $("#celltype_composition_help").hide();
        // Hide the corresponding option from ToC dropdown
        $("#toc_ctcomp").hide();
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
      // NB. Two different colour schemes are concatenated in order to provide
      // the colour resolution sufficient for the number of items on the sankey plot.
      // The colours are also shuffled - allowing the user to keep refreshing the page
      // until they see the colours they like on the cell composition plot.
      const unshuffled_colours = d3.schemePaired.concat(d3.Pastel2);
      let colours = unshuffled_colours
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)

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

function generateMicroenvironmentsPlot(data, anatomogram_labels) {

    if (!data.hasOwnProperty('color_domain')) {
        // N.B. 'color_domain' is set only if microenvironments is provided in config
        $("#spme_title").hide();
        $("#spme_header").hide();
        $("#spme").hide();
        $("#spme_save_button").hide();
        $("#spme_help").hide();
        // Hide the corresponding option from ToC dropdown
        $("#toc_spme").hide();
        return;
    }

     var left_xMargin = 400,
        right_xMargin = 320,
        top_yMargin = 60,
        bottom_yMargin = 190,
        yVals = data['y_vals'],
        yMin = -1,
        xMin = -1,
        yMax = yVals.length - 1,
        xVals = data['x_vals'],
        xMax= xVals.length - 1,
        mapping = data['raw_data'];

     var height = Math.max(500, 45 * yVals.length / Math.log10(Math.max(yVals.length, 2)));
     var width = Math.max(1000, 45 * xVals.length / Math.log10(Math.max(xVals.length, 2)));

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
        .attr("x", (right_xMargin + width) / 3)
        .attr("y", 12)
        .style("font-size", "16px")
        .attr("font-weight", 400)
        .attr("font-family", "Arial")
        .text(title)

      var yAxisLength = height - top_yMargin - bottom_yMargin,
        xAxisLength = width - left_xMargin - right_xMargin;

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

      spmeRenderYAxis(svg, yVals, yScale, left_xMargin, top_yMargin, xAxisLength, colorscale, anatomogram_labels);
      spmeRenderXAxis(svg, xVals, xScale, left_xMargin, height, top_yMargin, bottom_yMargin);
      for (var i = 0; i <= mapping.length - 1; i++) {
        vals = mapping[i];
        yPos = yVals.indexOf(vals[0]);
        xPos = xVals.indexOf(vals[1]);
        colorPos = colorDomain.indexOf(vals[1]);
        spmeRenderPoint(svg, xPos, yPos, colorPos, left_xMargin, top_yMargin, xScale, yScale, colorscale);
      }

      svg.selectAll("legend_dots")
        .data(colorDomain)
        .enter()
        .append("circle")
          .attr("cx", width - 290)
          .attr("cy", function(d,i){ return top_yMargin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .attr("r", 7)
          .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})
          .on("mousemove", function(event, d){ highlightCellTypesForMicroenvironment(d, mapping, colorDomain, colorscale);}) // highlight cell type labels on Y-axis corresponding to microenvironment d
          .on("mouseout", function(){setDeafultColourForAllCellTypes();}); // return all cell type labels on Y-axis to the default colour and font size

      svg.selectAll("legend_labels")
        .data(colorDomain)
        .enter()
        .append("text")
          .attr("x", width - 270)
          .attr("y", function(d,i){ return top_yMargin + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .style("fill", function(d){ return colorscale(colorDomain.indexOf(d))})
          .text(function(d){ return d})
          .attr("text-anchor", "left")
          .style("alignment-baseline", "middle")
          .on("mousemove", function(event, d){ highlightCellTypesForMicroenvironment(d, mapping, colorDomain, colorscale);}) // highlight cell type labels on Y-axis corresponding to microenvironment d
          .on("mouseout", function(){setDeafultColourForAllCellTypes();}); // return all cell type labels on Y-axis to the default colour
}

function highlightCellTypesForMicroenvironment(d, mapping, colourDomain, colorscale) {
   // Collect cell types corresponding to microenvironment d into cts
   var cts = [];
   for (var i = 0; i <= mapping.length - 1; i++) {
      vals = mapping[i];
      var ct = vals[0];
      var me = vals[1];
      if (me == d) {
        cts.push(ct);
      }
    }
    // Highlight on Y-axis only the cell types in cts
    var colour = colorscale(colorDomain.indexOf(d));
    d3.selectAll("#spme_y-axis g.tick").each(function() {
        d3.select(this).select("text").style("fill", function() {
            if (cts.includes(this.textContent)) {
                return colour;
            } else {
                return "#5a5757";
            }
        }).style("font-size", function() {
            if (cts.includes(this.textContent)) {
                return '17px';
            } else {
                return "12px";
            }
        })
    });
}

// Reset colour and font size to default for all cell types involved
function setDeafultColourForAllCellTypes() {
    d3.selectAll("#spme_y-axis g.tick").each(function() {
        d3.select(this).select("text").style("fill", function() {
            return "#5a5757";
        }).style("font-size", "12px")
    });
}

function spmeRenderXAxis(svg, xVals, xScale, left_xMargin, height, top_yMargin, bottom_yMargin) {
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
        return "translate(" + left_xMargin + "," + (height - bottom_yMargin) + ")";
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

function spmeRenderYAxis(svg, yVals, yScale, left_xMargin, top_yMargin, xAxisLength, colorscale, anatomogram_labels) {
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
        return "translate(" + left_xMargin + "," + top_yMargin + ")";
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

    // TODO: The code below is just for testing highlighting of different areas of anatomogram based on
    // which Y-axis label (cell type) the user mouses over.
    d3.selectAll("#spme_y-axis g.tick").each(function() {
      d3.select(this)
      .on("mouseover", function(){
            const anatomogram_label = anatomogram_labels[yVals.indexOf(this.textContent)];
            var elem = $('#ctcomp svg #LAYER_EFO #' + anatomogram_label + ' path').css({ fill: 'red' });
            })
      .on("mousemove", function(event){
            const anatomogram_label = anatomogram_labels[yVals.indexOf(this.textContent)];
            var elem = $('#ctcomp svg #LAYER_EFO #' + anatomogram_label + ' path').css({ fill: 'red' });
      })
      .on("mouseout", function(){
            const anatomogram_label = anatomogram_labels[yVals.indexOf(this.textContent)];
            var elem = $('#ctcomp svg #LAYER_EFO #' + anatomogram_label + ' path').css({ fill: '#dadada' });
       });
    });
}

function spmeRenderPoint(svg, x, y, colorPos, left_xMargin, top_yMargin, xScale, yScale, colorscale) {
    svg
      .append("circle")
      .attr("transform", function() {
        return "translate(" + left_xMargin + "," + top_yMargin + ")";
      })
      .attr("cx", xScale(x))
      .attr("cy", yScale(y))
      .attr("fill", colorscale(colorPos))
      // .attr("r", xScale(x)/25);
      .attr("r", 7);
}

function validateSGEInput(data) {
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
    errMsg = validateSGEInput(data);
    if (typeof errMsg !== 'undefined') {
        d3.select("#sge")
          .style("color", "purple")
          .text(errMsg);
        return;
    }

    var num_cts = data['cell_types'].length;
    var height = Math.max(700, 60 * num_cts / Math.log10(num_cts));
    var width = 1100,
    bottom_yMargin = 450,
    top_yMargin = 60,
    xMargin = 320,
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
        .attr("x", - xMargin + width * 3 / 4)
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
      .interpolator(d3.piecewise(d3.interpolateRgb.gamma(2.2), ["blue", "#cfc4c4", "red"]));


  sgeRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale);
  sgeRenderXAxis(svg, xVals, xScale, xMargin, height, top_yMargin, bottom_yMargin);
  const legend_xPos=width-115;
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
      sgeRenderPoint(svg, j, i, zscore, percents, deg, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale);
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
      const localLegendXOffset = legend_offset + 25;
      dotSizeLegend
       .append("text").attr("x", localLegendXOffset).attr("y", 110).text("Percent of cells").style("font-size", "15px")
        .attr("alignment-baseline","middle")
      dotSizeLegend
        .append("text").attr("x", localLegendXOffset).attr("y", 130).text("in cell type").style("font-size", "15px")
        .attr("alignment-baseline","middle")
      // dot size legend content
      dotSizeLegend.append("circle").attr("cx",localLegendXOffset).attr("cy",160).attr("r", 1).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",localLegendXOffset).attr("cy",190).attr("r", 2).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",localLegendXOffset).attr("cy",220).attr("r", 4).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",localLegendXOffset).attr("cy",250).attr("r", 6).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",localLegendXOffset).attr("cy",280).attr("r", 8).style("fill", "#404080")
      dotSizeLegend.append("circle").attr("cx",localLegendXOffset).attr("cy",310).attr("r", 10).style("fill", "#404080")
      dotSizeLegend.append("text").attr("x", localLegendXOffset + 35).attr("y", 160).text("(0, 0.2)").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", localLegendXOffset + 35).attr("y", 190).text("0.2").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", localLegendXOffset + 35).attr("y", 220).text("0.4").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", localLegendXOffset + 35).attr("y", 250).text("0.6").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", localLegendXOffset + 35).attr("y", 280).text("0.8").style("font-size", "15px").attr("alignment-baseline","middle")
      dotSizeLegend.append("text").attr("x", localLegendXOffset + 35).attr("y", 310).text("1").style("font-size", "15px").attr("alignment-baseline","middle")
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

function sgeRenderPoint(svg, j, i, zscore, percents, deg, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale) {
    const tooltip_yPos = yScale(i) + 160;
    const tooltip_xPos = xScale(j) + 300;
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
 function filterNumInteractions(data, cellTypes, isHeatmap, plotCnt) {
    if (plotCnt > 0) {
        numInteractions = data['num_ints'],
        ct2indx = data['ct2indx'];
    } else {
        numInteractions = data['num_ints_cts_sortedbyme'],
        ct2indx = data['ct_sortedbyme2indx'];
    }
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
      const numCellTypes = cellTypes.length;

      const microenvironments = data['microenvironments'];
      const me2cts = data['microenvironment2cell_types'];
      const ct2mes = data['cell_type2microenvironments'];
      var me2Colour = {};
      var ct2Colour = {};
      var xMargin = 200;
      var height = Math.max(600, 20 * numCellTypes / Math.log10(numCellTypes)) ;
      var width = Math.max(1000, 200 + 25 * numCellTypes / Math.log10(numCellTypes));
      var bottom_yMargin = 160,
        top_yMargin = 50,
        xMargin = 200,
        yVals = cellTypes,
        yMin = -1,
        xMin = -1,
        yMax = yVals.length - 1,
        xVals = cellTypes,
        xMax= xVals.length - 1,
        // min_ints, max_ints needed for color scale
        max_ints=parseInt(data['max_num_ints']),
        min_ints = title == "All cell types" ? 0 : parseInt(data['min_num_ints']),
        boxWidth = Math.round(380/yVals.length),
        legend_width=50
        legend_height=150,
        legend_xPos= width-360*Math.max(1,numCellTypes/105),
        title_xPos = legend_xPos * 0.5,
        legend_yPos=top_yMargin+50,
        xAxisYOffset = 1.1 + 10/numCellTypes;
        yAxisYOffset = 0.7 + 10/numCellTypes;
        tooltipXPos = legend_xPos;
        tooltipYPos = 0;

      $("#cci_summary_show_significant_interactions_only_div").show();
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
        title_xPos = legend_xPos * 0.6,
        legend_yPos=top_yMargin+50;
        xMargin = 140,
        xAxisYOffset = Math.max(-0.4*xVals.length + 3.3, -0.4*6 + 3.3),
        yAxisYOffset = Math.max(-0.5*yVals.length + 3.6, -0.5*6 + 3.6),
        tooltipXPos = legend_xPos,
        tooltipYPos = legend_yPos+180;
      } else {
        // Map each cell type label to its microenvironment colour if provided; black if no microenvironments provided
        // or cell type corresponds to multiple microenvironments
        if (microenvironments) {
              // See: https://observablehq.com/@d3/color-schemes
              const colours = d3.schemeCategory10;
              for (var i = 0; i < microenvironments.length; i++) {
                  const me = microenvironments[i];
                  if (typeof me2cts[me] != 'undefined') {
                    me2Colour[me] = colours[i % colours.length];
                  }
              }
        }
        for (var i = 0; i < cellTypes.length; i++) {
            var ct = cellTypes[i];
            if (microenvironments) {
                if (typeof ct2mes[ct] !== 'undefined' && ct2mes[ct].length == 1) {
                    me = ct2mes[ct][0];
                    ct2Colour[ct] = me2Colour[me];
                } else {
                    // ct maps to multiple microenvironments - make it black
                    me2Colour['multiple'] = 'black';
                    ct2Colour[ct] = me2Colour['multiple'];
                }
            } else {
                    // No microenvironments were provided, or they were but it's a microenvironment-specific plot => show all cell type labels in black
                    ct2Colour[ct] = 'black';
            }
         }
      }

      filteredNumInteractions = filterNumInteractions(data, cellTypes, true, plotCnt);

      // Remove any previous plot
      $("#cci"+plotCnt).empty();

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
        .attr("x", title_xPos)
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

      cciRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, ct2Colour, yAxisYOffset, plotCnt);
      cciRenderXAxis(svg, xVals, xScale, xMargin, height, bottom_yMargin, ct2Colour, xAxisYOffset, plotCnt);
      // cellType1
      for (var i = 0; i <= yVals.length - 1; i++) {
        // cellType2
        for (var j = 0; j <= xVals.length - 1; j++) {
          var num_ints = filteredNumInteractions[i][j];
          var cellType1 = yVals[i];
          var cellType2 = xVals[j];
          cciRenderRectangle(svg, j, i, yVals, xMargin, top_yMargin, xVals, xScale, yScale, colorscale, num_ints, plotCnt, tooltipXPos, tooltipYPos, boxWidth);
        }
      }

      // Heatmap colour legend:
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
        .baseValue((_, i) => (i > 0 ? expandedDomain[i - 1] : min_ints))
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

      // Categorical legend for cell type colours - by micro-environment
      if (microenvironments && plotCnt == 0) {
          const meLegend_xPos=legend_xPos-12;
          var meLegend_yPos = legend_yPos + legend_height - 30;

          const meLegenedWidth = 600;
          const meLegendHeight = 500;
          const meLegend = svg
                .append("svg")
                .attr("width", meLegenedWidth)
                .attr("height", meLegendHeight)
                .attr("x", meLegend_xPos)
                .attr("y", meLegend_yPos);

          // Microenvironments legend header
          meLegend
            .append("text").attr("x", 0).attr("y", 80).text("Microenvironments").style("font-size", "15px")
            .attr("alignment-baseline","middle")

          // Microenvironments legend content
          const size = 12;
          const meLegendStartYPos = 100;
          var meLegendYPos = meLegendStartYPos;
          for (var me in me2Colour) {
              var colour = me2Colour[me];
              meLegend.append("rect").attr("x",0).attr("y",meLegendYPos).attr("width", size).attr("height", size).style("fill", colour)
              meLegend.append("text").attr("x", 20).attr("y", meLegendYPos+6).text(me).style("font-size", "15px").attr("alignment-baseline","middle");
              meLegendYPos += 30;
          }
      }
 }

function cciRenderXAxis(svg, xVals, xScale, xMargin, height, bottom_yMargin, ct2Colour, xAxisYOffset, plotCnt) {
  var xAxis = d3
  .axisBottom()
  .ticks(xVals.length)
  .tickFormat(t => {
    return xVals[t];
  })
  .scale(xScale);
  svg
  .append("g")
  .attr("id", "cci_summary_x-axis" + plotCnt)
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

    // Colour cell types in different colour per microenvironment - for 'all cell types plot only'
    if (plotCnt == 0) {
        d3.selectAll("#cci_summary_x-axis" + plotCnt + " g.tick").each(function() {
            d3.select(this).select("text").style("fill", function() {
                var cell_type = this.textContent;
                return ct2Colour[cell_type];
            })
        });
    }
}

function cciRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, ct2Colour, yAxisYOffset, plotCnt) {
  var yAxis = d3
  .axisLeft()
  .ticks(yVals.length)
  .tickFormat(t => {
    return yVals[t];
  })
  .scale(yScale);
  svg
  .append("g")
  .attr("id", "cci_summary_y-axis" + plotCnt)
  .attr("transform", function() {
    return "translate(" + xMargin + "," + top_yMargin + ")";
  })
  .call(yAxis)
  .selectAll("text")
  .style("text-anchor", "end")
  .attr("dx", "-0.15em")
  .attr("dy", yAxisYOffset + "em");

    // Colour cell types in different colour per microenvironment - for 'all cell types plot only'
    if (plotCnt == 0) {
        d3.selectAll("#cci_summary_y-axis" + plotCnt + " g.tick").each(function() {
            d3.select(this).select("text").style("fill", function() {
                var cell_type = this.textContent;
                return ct2Colour[cell_type];
            })
        });
    }
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

function disableCCISummarySwitches() {
    $('#cci_summary_show_all_celltypes').attr("disabled", "true");
    $('#cci_summary_switch').attr("disabled", "true");
    $('#cci_summary_switch_lever').attr('style', "background-color: #9e9e9e !important;");
}

function maxCellTypesExceeded(all_cell_types) {
    return all_cell_types.length >= 150;
}

function refreshCCISpecificityAtAGlancePlot(data) {
    if (!data.hasOwnProperty('all_elems') || typeof data['all_elems'] === 'undefined') {
        $("#cci_specificity_section").hide();
        // Hide the corresponding option from ToC dropdown
        $("#toc_cci_specificity").hide();
        return;
     }

      var edges = data['edges'];
      var numStacks = data['num_stacks'];
      var sankey = new Sankey('cci_specificity');
      sankey.stack(0,data['list0'],data['y_space0'],data['y_box0']);
      sankey.stack(1,data['list1'],data['y_space1'],data['y_box1']);
      sankey.stack(2,data['list2'],data['y_space2'],data['y_box2']);
      sankey.stack(3,data['list3'],data['y_space3'],data['y_box3']);
      sankey.stack(4,data['list4'],data['y_space4'],data['y_box4']);
      sankey.stack(5,data['list5'],data['y_space5'],data['y_box5']);
      var elem2colour = {};
      // See: https://observablehq.com/@d3/color-schemes
      // const colours = d3.schemeTableau10.reverse();
      // NB. Two different colour schemes are concatenated in order to provide
      // the colour resolution sufficient for the number of items on the sankey plot.
      // The colours are also shuffled - allowing the user to keep refreshing the page
      // until they see the colours they like on the cell composition plot.
      const unshuffled_colours = d3.schemePaired.concat(d3.Pastel2);
      let colours = unshuffled_colours
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)

      var elems = data['all_elems'];
      for (var i = 0; i < elems.length; i++) {
        elem = elems[i];
        elem2colour[elem] = colours[i % colours.length];
      }
      // Colours
      sankey.setColors(elem2colour);
      sankey.right_margin = 100;
      sankey.left_margin = -100 * numStacks + 700;
      sankey.box_width = 30;
      // Box height
      sankey.convert_flow_values_callback = function(flow) {
        return flow * 0.05;
      };
      sankey.convert_flow_labels_callback = function(flow) {
        // Switched off edge labels:
        return Math.round(flow);
      };
      sankey.convert_box_value_labels_callback = function(flow) {
        // Switched off edge labels: return (""+Math.round(flow))
        return "";
      };
      sankey.setData(edges);

      // Insert title
      var title = "From left to right: top 3 interaction classes, and for each - top 3 interacting pairs (plus reminder, if any), and for each - top 3 cell type pairs (plus reminder, if any)";
      $("#cci_search_header").text(title);
      sankey.r.text(sankey.left_margin + 250, 10, title).attr({
        'font-size': '16px',
        'font-weight': '100'
      });

      sankey.draw();
}

function getQuerySeparator(previous) {
    if (previous) {
        return "&";
    } else {
        return "?";
    }
}

function refreshCCISummaryPlots() {
    $("#cci_summary_error").hide();
    $("#cci_summary_spinner").show();

    var projectId = getProjectId();
    var ret = getSelectedTokens(["cci_summary_selected_classes", "cci_summary_selected_microenvironments", "cci_summary_selected_modalities"]);
    var pos = 0;
    var selectedClasses = ret[pos++];
    var selectedMicroenvironments = ret[pos++];
    var selectedModalities = ret[pos++];
    var selectedMinInteractionScore = $('#cci_summary_selected_min_score').text();
    var url = './api/data/'+projectId+'/cell_cell_interaction_summary';
    if (selectedClasses) {
        url += "?classes=" + selectedClasses;
    }
    if (selectedModalities) {
        url += getQuerySeparator(selectedClasses) + "modalities=" + selectedModalities;
    }
    var prefix;
    if (cci_summary_selected_min_score) {
        url += getQuerySeparator(selectedClasses || selectedModalities) + "min_score=" + selectedMinInteractionScore;
    }
    $.ajax({
        url: url,
        contentType: "application/json",
        dataType: 'json',
        success: function(res) {
           if (res.hasOwnProperty('microenvironment2cell_types')) {
                if (maxCellTypesExceeded(res['all_cell_types'])) {
                        if (typeof selectedMicroenvironments != 'undefined' && selectedMicroenvironments.length > 1) {
                        $("#cci_summary_error").text("Due to a very large number of cell types in the analysis, the number of interactions can be plotted for one microenvironment only. Please restrict your microenvironments filter to just one and try again.")
                        $("#cci_summary_error").show();
                        $("#cci_summary_spinner").hide();
                        return;
                    }
                } else if (typeof selectedMicroenvironments != 'undefined' && selectedMicroenvironments.length > 9) {
                    $("#cci_summary_error").text("The number of interactions can be plotted for maximum of nine microenvironments. Please restrict your microenvironments filter to the maximum or less and try again.")
                    $("#cci_summary_error").show();
                    $("#cci_summary_spinner").hide();
                    return;
                }
                $("#cci_summary_buttons_div").show();
                microenvironment2cell_types = res['microenvironment2cell_types'];
                const map = new Map(Object.entries(microenvironment2cell_types));
                if (map.size > 0) {
                    // Populate placeholder to show the user available classes of interacting pairs
                    var all_microenvironments = Array.from(map.keys());
                    $("#cci_summary_microenvironment_input").attr("placeholder",all_microenvironments.toString());
                    $("#cci_summary_microenvironment_div").show();
                    enable_autocomplete('cci_summary_microenvironment_input', 'cci_summary_selected_microenvironments', all_microenvironments);
                    var cnt = 1;
                    var max = 9;
                    if (maxCellTypesExceeded(res['all_cell_types'])) {
                        // Plot only one per-microenvironment plot
                        // N.B. cnt = 0 has the effect of plotting the one per-microenvironment plot as if it was an 'all cell types' plot
                        // if maxCellTypesExceeded(res) had been false - that is in the larger format. Normally if maxCellTypesExceeded(res) is false,
                        // per-microenvironment plots are plotted in the smaller format, but here because maxCellTypesExceeded(res) is true, we're
                        // assuming that it is more likely that the number of cell types to plot will be great and thus we default to the larger plot format.
                        cnt = 0;
                        max = 0;
                    }
                    // Remove all previous plots first
                    for (var i = 0; i <= 9; i++) {
                        $("#cci"+i).empty();
                    }
                    // First calculate min_num_ints and max_num_ints across the cell types in all microenvironments
                    var min_num_ints = res['max_num_ints'];
                    var max_num_ints = res['min_num_ints'];
                    for (let [microenvironment, cellTypes] of map.entries()) {
                        const num_ints_csv = filterNumInteractions(res, cellTypes, false, cnt);
                        const chordData = d3.csvParse(num_ints_csv, d3.autoType);
                        const num_ints = Array.from(new Set(chordData.flatMap(d => [parseInt(d.value)])));
                        const meMin = Math.min(...num_ints);
                        const meMax = Math.max(...num_ints);
                        if (meMin < min_num_ints) {
                            min_num_ints = meMin;
                        }
                        if (meMax > max_num_ints) {
                            max_num_ints = meMax;
                        }
                    }
                    res['min_num_ints'] = min_num_ints;
                    res['max_num_ints'] = max_num_ints;
                    // Now generate the per-microenvironment plots
                    for (let [microenvironment, cellTypes] of map.entries()) {
                        if (typeof selectedMicroenvironments == 'undefined' || decodeURI(selectedMicroenvironments).includes(microenvironment)) {
                            generateCellCellInteractionSummaryPlot(res, cellTypes.sort(), microenvironment, cnt);
                            storeToken(microenvironment, "cci_summary_selected_microenvironments", "cci_summary_microenvironment_input");
                            cnt++;
                            if (cnt > max) {
                                // TODO: We currently only have up to nine slots for microenvironment-specific cci plots available if !maxCellTypesExceeded(res)
                                break;
                            }
                        }
                    }
                    // Generate plot across cell types also - in case the user wishes to see it
                    // Note: The plot is generated if the number of cell types has not exceeded the maximum
                   if (!maxCellTypesExceeded(res['all_cell_types'])) {
                       generateCellCellInteractionSummaryPlot(res, res['all_cell_types_for_sortedbyme'], "All cell types", 0);
                       if ($('#cci_summary_show_all_celltypes').is(':checked')) {
                           $("#cci0_div").show();
                       } else {
                           $("#cci0_div").hide();
                       }
                   } else {
                       disableCCISummarySwitches();
                   }
                } else {
                    // Generate plot across cell types also - in case the user wishes to see it
                    // Note: The plot is generated if the number of cell types has not exceeded the maximum
                    if (!maxCellTypesExceeded(res['all_cell_types'])) {
                        generateCellCellInteractionSummaryPlot(res, res['all_cell_types_for_sortedbyme'], "All cell types", 0);
                        // Hide microenvironment input
                        $("#cci_search_microenvironment_sel").hide();
                    } else {
                        disableCCISummarySwitches();
                    }
                }
            } else {
                // Generate plot across cell types
                // Note: The plot is generated if the number of cell types has not exceeded the maximum
                if (!maxCellTypesExceeded(res['all_cell_types'])) {
                    generateCellCellInteractionSummaryPlot(res, res['all_cell_types_for_sortedbyme'], "All cell types", 0);
                    // Hide microenvironment input
                    $("#cci_search_microenvironment_sel").hide();
                } else {
                    disableCCISummarySwitches();
                }
            }
           if (res.hasOwnProperty('all_classes')) {
                enable_autocomplete('cci_summary_class_input', 'cci_summary_selected_classes', res['all_classes']);
               // Populate placeholder to show the user available classes of interacting pairs
                $("#cci_summary_class_input")
                    .attr("placeholder",res['all_classes'].toString());
                $("#cci_summary_class_filter_div").show();
                $("#cci_summary_buttons_div").show();
            }
            if (res.hasOwnProperty('all_modalities')) {
                enable_autocomplete('cci_summary_modality_input', 'cci_summary_selected_modalities', res['all_modalities']);
               // Populate placeholder to show the user available classes of interacting pairs
                $("#cci_summary_modality_input")
                    .attr("placeholder",res['all_modalities'].toString());
                $("#cci_summary_modality_filter_div").show();
                $("#cci_summary_buttons_div").show();
            }


            if (res.hasOwnProperty('interaction_scores')) {
                $("#cci_summary_score_div").show();
            }
            // Allow the user to switch between cci_summary heatmaps and chord plots
            num_cell_types = res['all_cell_types'].length;
            if (num_cell_types > 40) {
                // Chord plots don't work if num_cell_types > 40 - hence disabled the switch
                $('#cci_summary_switch').attr("disabled", "true");
                $('#cci_summary_switch_lever').attr('style', "background-color: #9e9e9e !important;");
            } else {
                enable_cci_summary_switch(num_cell_types);
            }
            // Hide progress spinner
            $("#cci_summary_spinner").hide();
        }
     });
}

function clearSGEFilters() {
    $('.sge_selected_genes').empty();
    $('.sge_selected_celltypes').empty();
}

function clearCCISummaryFilters() {
    $('.cci_summary_selected_classes').empty();
    $('.cci_summary_selected_microenvironments').empty();
    $('#cci_summary_selected_min_score').text("0");
    $('#cci_summary_score_input').val(0);
}

function clearCCISearchFilters() {
    $('.cci_search_selected_genes').empty();
    $('.cci_search_selected_celltypes').empty();
    $('.cci_search_selected_interactions').empty();
    $('.cci_search_selected_celltype_pairs').empty();
    $('.cci_search_selected_classes').empty();
}

function clearCCISearchCellTypeFilters() {
    $('.cci_search_selected_celltypes').empty();
    $('.cci_search_selected_celltype_pairs').empty();
}

function clearCCISearchInteractionFilters() {
    $('.cci_search_selected_interactions').empty();
}

function getPValBucket(pVal) {
    var ret;
    if (typeof pVal === 'undefined') {
        pVal = 1;
    }
    if (pVal > 0) {
        ret = Math.min(Math.round(Math.abs(Math.log10(pVal))), 3)
    } else {
        ret = 3
    }
    return ret;
}

function validateCCISearchInput(data) {
    var errMsg;
    if (!data.hasOwnProperty('selected_cell_type_pairs') || data['selected_cell_type_pairs'].length == 0) {
        if (!data.hasOwnProperty('selected_interacting_pairs') || data['selected_interacting_pairs'].length == 0) {
            errMsg = 'Please select at least one interacting pair and at least two cell type pairs.';
        } else {
            errMsg = 'Please select at least two cell type pairs.';
        }
    } else if (data['selected_cell_type_pairs'].length == 1) {
        // Z-scores (calculated across all selected cell type pairs) cannot be calculated when only
        // one cell type pair has been selected - report an error
        errMsg = 'The plot shows z-scores that cannot be calculated if only one cell type pair is selected. Please select more than one cell type pair.';
    } else if (!data.hasOwnProperty('interacting_pairs_means')) {
        errMsg = 'No significant interactions were found - please try another search.';
    }
    return errMsg;
}

function generateCellCellInteractionSearchPlot(data, storeTokens, interacting_pairs_selection_logic) {

    const valuesToShow = $('input[name=cci_search_radio]:checked').val();
    // DEBUG console.log(data);
    const selectedGenes = data['selected_genes'];
    const selectedInteractingPairs = data['selected_interacting_pairs'];
    const selectedCellTypes = data['selected_cell_types'];
    const selectedCellTypePairs = data['selected_cell_type_pairs'];
    const selectedCTP2Me = data['selected_cell_type_pairs2microenvironment'];
    const selectedIP2Class = data['selected_interacting_pair2class'];
    const selectedIP2Modality = data['selected_interacting_pair2modality'];
    const microenvironments = data['microenvironments']
    const selectedMicroenvironments = data['selected_microenvironments']
    const cellsign_active_interactions = data['cellsign_active_interactions']
    const interacting_pair2participants = data['interacting_pair2participants'];
    // interacting_pair2properties is retrieved from analysis_means file
    const interacting_pair2properties = data['interacting_pair2properties'];
    // interacting_pair2classes is retrieved from analysis_means file - is available in versions>=v5.0.0 of cellphonedb-data
    const interacting_pair2classes = data['interacting_pair2classes'];
    // interacting_pair2modalities is retrieved from analysis_means file - is available in versions>=v5.1.0 of cellphonedb-data
    const interacting_pair2modalities = data['interacting_pair2modalities'];
    // interacting_pair2properties_html from CellphoneDB database file - it it was provided in the config file
    const interacting_pair2properties_html = data['interacting_pair2properties_html'];
    if (typeof interacting_pair2properties_html != 'undefined') {
        // CellphoneDB database file name was provided in config file - we have richer participants info to show (in sidenav) than
        // interacting_pair2properties (retrieved from analysis means file and shown as a tooltip) - insert sidenav content
        // into #cci_search_sidenav_content div
        for (var ip in interacting_pair2properties_html) {
            $('#cci_search_sidenav_content').append(interacting_pair2properties_html[ip]);
        }
    }

    // This section is done outside of storeTokens below as both microenvironments or cell type may have been removed by the user (and thus pre-selected automatically)
    // before the plot is refreshed
    if (typeof selectedMicroenvironments != 'undefined' && selectedMicroenvironments.length > 0 && $('.cci_search_selected_microenvironments').is(':empty')) {
         // This is the case on first page load for v. large data sets
         for (var i = 0; i < selectedMicroenvironments.length; i++) {
             storeToken(selectedMicroenvironments[i], "cci_search_selected_microenvironments", "cci_search_microenvironment_input");
        }
    } else if ($('.cci_search_selected_celltypes').is(':empty')) {
        for (var i = 0; i < selectedCellTypes.length; i++) {
            storeToken(selectedCellTypes[i], "cci_search_selected_celltypes", "cci_search_celltype_input");
        }
    }


    if (storeTokens) {
        for (var i = 0; i < selectedGenes.length; i++) {
            storeToken(selectedGenes[i], "cci_search_selected_genes", "cci_search_gene_input");
        }
        for (var i = 0; i < selectedInteractingPairs.length; i++) {
            storeToken(selectedInteractingPairs[i], "cci_search_selected_interactions", "cci_search_interaction_input");
        }
        if (typeof selectedMicroenvironments === 'undefined' || selectedMicroenvironments.length == 0) {
            for (var i = 0; i < selectedCellTypePairs.length; i++) {
                storeToken(selectedCellTypePairs[i], "cci_search_selected_celltype_pairs", "cci_search_celltype_pair_input");
            }
        }
    } else if (typeof interacting_pairs_selection_logic !== 'undefined') {
        // The user selected a new interacting_pairs_selection_logic - clear previously selected interacting pairs and
        // repopulate from selectedInteractingPairs
        $('.cci_search_selected_interactions').empty();
        for (var i = 0; i < selectedInteractingPairs.length; i++) {
            storeToken(selectedInteractingPairs[i], "cci_search_selected_interactions", "cci_search_interaction_input");
        }
        // Clear selected genes - as interacting_pairs_selection_logic overrides all previous gene/interacting pairs selections
        $('.cci_search_selected_genes').empty();
        // Hide progress spinner
        $("#cci_search_sel_ips_logic_spinner").hide();

        const num_all_cell_type_pairs = parseInt($("#num_all_cell_type_pairs").text());
        if (interacting_pairs_selection_logic == "all" && selectedCellTypePairs.length == num_all_cell_type_pairs) {
            M.toast({html: 'N.B. Your browser may not have enough memory to plot all cell type pairs and all relevant interactions. Consider restricting the number of cell type pairs to be shown in the plot.'})
        }
        // The value in this field will be used when the user clicks on 'Refresh plot' button later
        $('#interacting_pairs_selection_logic').text(interacting_pairs_selection_logic);
        // To keep the behaviour consistent across all input fields on the page - if the user selected a new interacting_pairs_selection_logic,
        // we just re-populate the cci_search_selected_interactions field and stop short of refreshing the plot itself. The user still needs to click
        // on 'Refresh plot' button to make that happen.
        return;
    } else {
        // Remove the previous plot as it will be re-generated
        $("#cci_search").empty();
    }

    // Show error message and return if data input is invalid
    errMsg = validateCCISearchInput(data);
    if (typeof errMsg !== 'undefined') {
        d3.select("#cci_search")
          .style("color", "purple")
          .text(errMsg);
        return;
    }

    // See: https://observablehq.com/@d3/color-schemes
    const colours = d3.schemeCategory10.concat(d3.schemeSet2)
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

    var class2Colour = {};
    if (typeof selectedIP2Class !== 'undefined') {
        var classes = Array.from(new Set(Object.values(selectedIP2Class)));
        for (var i = 0; i < classes.length; i++) {
          const ipClass = classes[i];
          if (ipClass != "none") {
            class2Colour[ipClass] = colours[i % colours.length];
          } else {
            // If interaction ip was not classified, show it in black.
            class2Colour[ipClass] = "black";
          }
        }
    }

    // This is needed for the legend that maps acronyms (displayed next to interacting pair labels) to their corresponding modality
    var modality2Acronym = { 'Cell-Cell Contact' : 'CCC', 'ECM-Receptor' : 'ECMR', 'Small Molecule-Mediated' : 'SMM', 'Secreted Signaling' : 'SS' };

    var classes4Legend = [];
    var ip2Colour = {}
    for (var i = 0; i < selectedInteractingPairs.length; i++) {
      const ip = selectedInteractingPairs[i];
      if (typeof selectedIP2Class === 'undefined') {
          // No classification information is present in analysis means file - show all ips in the default teal colour
          ip2Colour[ip] = "#008080"; // teal
      } else {
          const ipClass = selectedIP2Class[ip];
          ip2Colour[ip] = class2Colour[ipClass];
          if (!classes4Legend.includes(ipClass)) {
            classes4Legend.push(ipClass);
          }
      }
    }

    var modalities4Legend = [];
    var ip2ModalityAcronym = {}
    for (var i = 0; i < selectedInteractingPairs.length; i++) {
      const ip = selectedInteractingPairs[i];
      if (typeof selectedIP2Modality == 'undefined') {
          // No modality information is present in analysis means file - don't show any acronyms
          ip2ModalityAcronym[ip] = '';
      } else {
          const ipModality = selectedIP2Modality[ip];
          ip2ModalityAcronym[ip] = modality2Acronym[ipModality];
          if (!modalities4Legend.includes(ipModality)) {
            modalities4Legend.push(ipModality);
          }
      }
    }

    // Needed for calculating the left margin
    // Note shallow copy of data['interacting_pairs_means'] below -
    // we want to preserve the order of data['interacting_pairs_means']
    var longest_ip_label = [...data['interacting_pairs_means']].sort(
        function (a, b) {
            return b.length - a.length;
        })[0];
    var longest_ct_label = [...data['cell_type_pairs_means']].sort(
        function (a, b) {
            return b.length - a.length;
        })[0];

    var num_ips = data['interacting_pairs_means'].length;
    var num_ctps = data['cell_type_pairs_means'].length;
    var height = 700;
    if (num_ips > 1) {
        height = Math.max(height, 40 * num_ips / Math.log10(num_ips));
    }
    // Note that validateCCISearchInput() above ensures that num_ctps > 1
    var width = Math.max(1400, 45 * num_ctps / Math.log10(num_ctps));
    bottom_yMargin = 250,
    top_yMargin = 60,
    xMargin = Math.max(longest_ip_label.length * 7.3, longest_ct_label.length * 3.4);
    if (interacting_pair2classes || interacting_pair2modalities) {
        // Leave space on the LHS for the Interaction classes legend
        xMargin += 180;
    }
    var yVals = data['interacting_pairs_means'],
    yMin = -1,
    xMin = -1,
    yMax = yVals.length - 1,
    xVals = data['cell_type_pairs_means'],
    xMax= xVals.length - 1,
    mean_values = data['values'],
    pvalues=data['filtered_pvalues'],
    interaction_scores=data['filtered_interaction_scores'],
    relevant_interactions=data['filtered_relevant_interactions'];

    const tooltip_xPos = 510;
    const tooltip_yPos = 10;

  // min_value, max_value needed for color scale
  max_val=data['max_value'];
  if (valuesToShow == "zscores") {
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
    // The extract 150px is needed if many classes are shown in the bottom LHS legend
    .attr("height", height + 150);

    // Insert title
    var prefix = "S";
    if (storeTokens) {
        prefix = "Top 10 s";
    } else if (interacting_pairs_selection_logic) {
        prefix = "Top " + interacting_pairs_selection_logic + "s";
    }
    var title = prefix + "ignificant interactions across the selected cell type pairs";
    if (typeof interacting_pairs_selection_logic === 'undefined') {
        // This covers the case when the user had selected interacting_pairs_selection_logic, and now they have clicked on 'Refresh plot' button -
        // We need to recover interacting_pairs_selection_logic the user previously selected
        interacting_pairs_selection_logic = $('#interacting_pairs_selection_logic').text();
    }

    // The title in #cci_search_header div is used for naming of the PDF file when the plot is downloaded
    $("#cci_search_header").text(title);
    svg.append("text")
        .attr("x", width * 0.32)
        .attr("y", 20)
        .style("font-size", "16px")
        .attr("font-weight", 400)
        .attr("font-family", "Arial")
        .text(title);

    var ip_info = " on an interaction pair on Y axis and on each circle in the plot for more information.";
    if (typeof interacting_pair2properties_html !== 'undefined') {
        ip_info = "Click" + ip_info;
    } else {
        ip_info = "Mouse over " + ip_info;
    }
    var ip_help_content = $("#interacting_pair_help").attr("data-tooltip");
    $("#interacting_pair_help").attr("data-tooltip", ip_help_content + ip_info);

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
  if (valuesToShow == "zscores") {
       // Make z-score colour legend symmetric
       const max_abs_zscore = Math.max(Math.abs(min_val), max_val);
       min_val = -1 * max_abs_zscore;
       max_val = max_abs_zscore;
       colorscale = d3
          .scaleSequential()
          .domain([min_val, max_val])
          // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
          .interpolator(d3.piecewise(d3.interpolateRgb.gamma(2.2), ["blue", "#cfc4c4", "red"]));
  } else {
       colorscale = d3
          .scaleSequential()
          .domain([min_val, max_val])
          // See: https://observablehq.com/@d3/working-with-color and https://github.com/d3/d3-interpolate
          .interpolator(d3.piecewise(d3.interpolateRgb.gamma(2.2), ["black", "blue", "yellow", "red"]));
  }

  cciSearchRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale, tooltip_xPos, tooltip_yPos,
                       interacting_pair2participants, interacting_pair2properties, interacting_pair2properties_html,
                       interacting_pair2classes, ip2Colour, ip2ModalityAcronym);
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
      if (typeof cellsign_active_interactions !== 'undefined' &&
          typeof cellsign_active_interactions[interaction] !== 'undefined' &&
          cellsign_active_interactions[interaction].hasOwnProperty(cellTypePair)) {
            activeInteractionInfo = cellsign_active_interactions[interaction][cellTypePair];
      }
      cciSearchRenderPoint(svg, j, i, value, pValue, relIntFlag, cellTypePair, interaction, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, pvalues, valuesToShow, activeInteractionInfo);
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
    if (valuesToShow == "zscores") {
        legendLabel += " z-score";
    } else if (valuesToShow == "scores") {
        legendLabel = "Score";
    }
    svg
    .append("text").attr("x", barLegend_xPos-12).attr("y", top_yMargin+10).text(legendLabel).style("font-size", "15px").style("font-weight", "bold")
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
        .append("text").attr("x", 5).attr("y", 80).text("-log").style("font-size", "15px").style("font-weight", "bold")
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
        .append("text").attr("x", 5).attr("y", 80).text("Microenvironments").style("font-size", "15px").style("font-weight", "bold")
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

    var modalityLegendHeight = 0;
    if (interacting_pair2modalities) {
      // Legend for modality acronyms
      const modalityLegend_xPos= 10;
      const modalityLegenedWidth = 450;
      modalityLegendHeight = 250;
      const modalityLegend_yPos = -20;
      const modalityLegend = svg
            .append("svg")
            .attr("width", modalityLegenedWidth)
            .attr("height", modalityLegendHeight)
            .attr("x", modalityLegend_xPos)
            .attr("y", modalityLegend_yPos);

      // Modality legend header
      modalityLegend
        .append("text").attr("x", 5).attr("y", 80).text("Interaction modalities").style("font-size", "15px").style("font-weight", "bold")
        .attr("alignment-baseline","middle")

      // Modality legend content
      const size = 12;
      const modalityLegendStartYPos = 110;
      var modalityLegendYPos = modalityLegendStartYPos;
      for (var i = 0; i <= modalities4Legend.length - 1; i++) {
          var ipModality = modalities4Legend[i];
          if (ipModality.length > 20) {
            shortenedIPModality = ipModality.substring(0,20)+"..";
          } else {
            shortenedIPModality = ipModality;
          }
          var acronym = modality2Acronym[ipModality];
          modalityLegend.append("text").attr("y",modalityLegendYPos).text(acronym).style("font-size", "15px").attr("alignment-baseline","middle");
          modalityLegend.append("text").attr("x",50).attr("y", modalityLegendYPos).text(shortenedIPModality).style("font-size", "15px").attr("alignment-baseline","middle");
          modalityLegendYPos += 30;
      }
  }

  if (interacting_pair2classes) {
      // Legend for interacting pair colours (on Y axis) - by class
      const classLegend_xPos= 10;
      const classLegenedWidth = 450;
      const classLegendHeight = 700;
      var classLegend_yPos = -20;
      if (modalityLegendHeight > 0) {
        classLegend_yPos = modalityLegendHeight - 100;
      }
      const classLegend = svg
            .append("svg")
            .attr("width", classLegenedWidth)
            .attr("height", classLegendHeight)
            .attr("x", classLegend_xPos)
            .attr("y", classLegend_yPos);

      // Classes legend header
      classLegend
        .append("text").attr("x", 5).attr("y", 80).text("Interaction classes").style("font-size", "15px").style("font-weight", "bold")
        .attr("alignment-baseline","middle")

      // Classes legend content
      const size = 12;
      const classLegendStartYPos = 100;
      var classLegendYPos = classLegendStartYPos;
      for (var i = 0; i <= classes4Legend.length - 1; i++) {
          var ipClass = classes4Legend[i];
          if (ipClass.length > 20) {
            shortenedIPClass = ipClass.substring(0,20)+"..";
          } else {
            shortenedIPClass = ipClass;
          }
          var colour = class2Colour[ipClass];
          classLegend.append("rect").attr("x",0).attr("y",classLegendYPos).attr("width", size).attr("height", size).style("fill", colour)
          classLegend.append("text").attr("x",20).attr("y", classLegendYPos+6).text(shortenedIPClass).style("font-size", "15px").attr("alignment-baseline","middle");
          classLegendYPos += 30;
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

function cciSearchRenderYAxis(svg, yVals, yScale, xMargin, top_yMargin, xAxisLength, colorscale, tooltip_xPos, tooltip_yPos,
                              interacting_pair2participants, interacting_pair2properties, interacting_pair2properties_html,
                              interacting_pair2classes, ip2Colour, ip2ModalityAcronym) {
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

   var tooltip =
        d3.select("#cci_search")
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
        .attr("id", "cci_search_tooltip");

     // Retrieve properties of at least one participant in the interaction
     function getInteractionProperties(property2val) {
        var properties = '';
        if (property2val['is_integrin'] == true) {
            if (properties != '') {
                    properties += ", ";
                }
                properties += "<b>integrin</b>";
        }
        return properties;
     }

     // Retrieve properties of one interaction participant, the one identified by letter
     function getParticipantProperties(property2val, letter) {
        var properties = '';
        if (property2val['receptor_' + letter] == true) {
            if (properties != '') {
                    properties += ", ";
            }
            properties += "<b>receptor</b>";
        }
        if (letter == 'a') {
            if (property2val['secreted'] == true) {
                if (properties != '') {
                    properties += ", ";
                }
                properties += "<b>secreted</b>";
            }
        }
        return properties;
     }

     // Assemble a tooltip content for interactingPair
     function getTooltipContent(interactingPair) {
        const gap = '&nbsp; ';
        var ret = "Interacting pair: <b>" + interactingPair + "</b><br>";
        const participants = interacting_pair2participants[interactingPair];
        const property2val = interacting_pair2properties[interactingPair];
        // Classes are kept separate from the other properties because versions<5.0.0 of cellphonedb-data doesn't have interaction classifications
        // Populate interaction classification info, if provided
        if (typeof interacting_pair2classes !== 'undefined' && interacting_pair2classes.hasOwnProperty(interactingPair)) {
            const classes = interacting_pair2classes[interactingPair];
            ret += "Interaction classification: <b>" + classes + "</b><br>";
        }
        if (typeof interacting_pair2modalities !== 'undefined' && interacting_pair2modalities.hasOwnProperty(interactingPair)) {
            const modalities = interacting_pair2modalities[interactingPair];
            ret += "Interaction modality: <b>" + modalities + "</b><br>";
        }
        var prevPartner;
        var complexName;
        var letter;
        var interactionProperties = undefined;
        for (var k = 0; k < participants.length; k++) {
            const row = participants[k];
            let [geneName, uniprotAcc, proteinName, complexName] = participants[k];
            letter = ['a','b'][Math.min(k,1)];
            var curPartner;
            if (complexName != '') {
                curPartner = complexName;
            } else {
                curPartner = geneName;
            }
            if (typeof prevPartner === 'undefined' || curPartner != prevPartner) {
                ret += "Partner " + letter + ": <b>" + curPartner + "</b><br>";
            }
            ret += gap + gap + " - Gene name: <b>" + geneName + "</b>"
                 + gap + "Uniprot: <b>" + uniprotAcc + "</b>"
                 + gap + "Protein name: <b>" + proteinName + "</b><br>";
            var properties = getParticipantProperties(property2val, letter);
            if (typeof prevPartner === 'undefined' || curPartner != prevPartner) {
                if (properties != '') {
                     ret += gap + gap + "Properties: " + properties + "<br>";
                     properties = '';
                }
            }
            prevPartner = curPartner;
        }
        if (properties != '') {
             ret += gap + gap + "Properties: " + properties + "<br>";
        }
        properties = getInteractionProperties(property2val);
        if (properties != '') {
             ret += "Properties of one or both participants: " + properties + "<br>";
        }
        return ret;
     }

     if (typeof interacting_pair2properties_html !== 'undefined') {
         d3.selectAll("#cci_search_y-axis g.tick").each(function() {
            d3.select(this)
            .on("click", function(d) {
                // split() below is needed in the case the modality was appended to this.textContent (see below)
                var instance = M.Sidenav.getInstance($('#sidenav_' + this.textContent.split(" ")[0]));
                instance.open();
            })
            .select("text").style("cursor", function() {
                return "pointer";
            }).style("fill", function() {
                var ip = this.textContent;
                // Append modality acronym to the interacting pair label
                if (this.textContent && ip2ModalityAcronym[ip]) {
                    this.textContent = this.textContent + " - " + ip2ModalityAcronym[ip];
                }
                return ip2Colour[ip];
            })
        });
     } else {
         d3.selectAll("#cci_search_y-axis g.tick").each(function() {
            d3.select(this)
            // split() below is needed in the case the modality was appended to this.textContent (see below)
            .on("mouseover", function(){ tooltip.html(getTooltipContent(this.textContent.split(" ")[0])); return tooltip.style("visibility", "visible");})
            .on("mousemove", function(event){return tooltip.style("top", tooltip_yPos+'px').style("left",tooltip_xPos +'px')})
            .on("mouseout", function(){return tooltip.style("visibility", "hidden")})
            .select("text").style("fill", function() {
                var ip = this.textContent;
                // Append modality acronym to the interacting pair label
                if (this.textContent && ip2ModalityAcronym[ip]) {
                    this.textContent = this.textContent + " - " + ip2ModalityAcronym[ip];
                }
                return ip2Colour[ip];
            })
        });
    }
}

function cciSearchRenderPoint(svg, j, i, value, pValue, relIntFlag, cellTypePair, interaction, xMargin, top_yMargin, xScale, yScale, xVals, yVals, colorscale, pvalues, valuesToShow, activeInteractionInfo) {
    const tooltip_xPos = xScale(j) + 240;
    const tooltip_yPos = yScale(i) + 240;
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
    if (valuesToShow == "zscores") {
       valLabel = "Z-score";
    } else if (valuesToShow == "scores") {
       valLabel = "Score";
    }
    var tooltipContent = interaction + "<br>Cell type pair: " + cellTypePair + "<br>" + valLabel + ": " + value;
    if (pvalues) {
        tooltipContent += "<br>Nominal P-value: " + pValue;
        tooltipContent += "<br>-log10pvalue bucket: ";
        if (pvalBucket == 3) {
            tooltipContent += ">=";
        }
        tooltipContent += pvalBucket;
    } else if (relIntFlag && typeof activeInteractionInfo !== 'undefined') {
        tooltipContent = "<b>Relevant and active</b> interaction " + tooltipContent;
    } else if (relIntFlag) {
        tooltipContent = "<b>Relevant</b> interaction: " + tooltipContent;
    } else if (typeof activeInteractionInfo !== 'undefined') {
        tooltipContent = "<b>Active</b> interaction: " + tooltipContent;
    } else {
        tooltipContent = "Interaction: " + tooltipContent;
    }
    // Assemble in activeTFsCellTypesStr and add to tooltipContent information about all active TFs/active cell types
    if (typeof activeInteractionInfo !== 'undefined') {
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

    if (typeof activeInteractionInfo != 'undefined') {
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

function refreshCCISearchPlot(interacting_pairs_selection_logic) {
    var projectId = getProjectId();

    const sort_interacting_pairs_alphabetically = $('#cci_search_sort_ips_switch').is(':checked');
    const valuesToShow = $('input[name=cci_search_radio]:checked').val();
    var ret = getSelectedTokens([
        "cci_search_selected_genes", "cci_search_selected_celltypes",
        "cci_search_selected_celltype_pairs", "cci_search_selected_interactions",
        "cci_search_selected_microenvironments", "cci_search_selected_classes"]);
    var pos=0;
    var selectedGenes = ret[pos++];
    var selectedCellTypes = ret[pos++];
    var selectedCellTypePairs = ret[pos++];
    var selectedInteractions = ret[pos++];
    var selectedMicroenvironments = ret[pos++];
    var selectedClasses = ret[pos++];
    // DEBUG console.log(selectedGenes, selectedCellTypes, selectedCellTypePairs, selectedInteractions);
    var url = './api/data/'+projectId+'/cell_cell_interaction_search';
    if (selectedGenes || selectedCellTypes || selectedInteractions || selectedCellTypePairs || selectedClasses) {
        url += "?";
        if (selectedClasses) {
            url += "classes=" + selectedClasses + "&";
        }
        if (selectedGenes) {
            url += "genes=" + selectedGenes + "&";
        }
        if (selectedInteractions) {
            if (typeof interacting_pairs_selection_logic !== 'undefined') {
                // There's no point increasing the length of the GET request unnecessarily with the current selection
                // of interacting pairs if all we need the API call to do is overwrite them with with interacting_pairs_selection_logic
                // This is particularly important if selectedInteractions contain all interacting pairs - then the maximum length of GET request
                // could be exceeded if we didn't do the below.
                selectedInteractions=''
            }
            url += "interacting_pairs=" + selectedInteractions + "&";
        }
        if (selectedCellTypes) {
            url += "cell_types=" + selectedCellTypes + "&";
        }
        if (selectedCellTypePairs) {
            url += "cell_type_pairs=" + selectedCellTypePairs + "&";
        }
        if (selectedMicroenvironments) {
            url += "microenvironments=" + selectedMicroenvironments + "&";
        }
    } else {
        url += "?";
    }
    // In refresh mode, we don't pre-select cell type pairs - if the user did not enter any
    url += "refresh_plot=True&values_to_show=" + valuesToShow;
    if (typeof interacting_pairs_selection_logic !== 'undefined') {
        url += "&interacting_pairs_selection_logic=" + interacting_pairs_selection_logic;
    }
    url += "&sort_interacting_pairs_alphabetically=" + sort_interacting_pairs_alphabetically;

    // The retrieval may take a few seconds - show spinner to indicate to the user that an operation is in progress so that the don't try refreshing
    // the page and starting again..
    $("#cci_search_sel_ips_logic_spinner").show();
    // Hide any error message from the previous search
    $("#cci_search_sel_ips_request_error").hide();
    $.ajax({
            url: url,
            contentType: "application/json",
            dataType: 'json',
            success: function(res) {
                generateCellCellInteractionSearchPlot(res, storeTokens=false, interacting_pairs_selection_logic);
                // Enable side navs - used for displaying interacting pair participant information
                enable_side_navs();
            },
            complete: function(jqXHR, textStatus) {
                var errMsg;
                if (jqXHR.status == 400) {
                    $("#cci_search_sel_ips_request_error").text("ERROR: Your search criteria are too large for this service to handle. Please restrict your search and try again.")
                    $("#cci_search_sel_ips_request_error").show();
                } else if (jqXHR.status != 200) {
                    $("#cci_search_sel_ips_request_error").text("An unexpected error occurred. Your search criteria may be too large for this service to handle. Please restrict your search and try again. If that doesn't work, please try again later.")
                    $("#cci_search_sel_ips_request_error").show();
                    // console.log(jqXHR, jqXHR.status, textStatus);
                }
                $("#cci_search_sel_ips_logic_spinner").hide();
                $("#cci_search_spinner").hide();
            }
     });
}

// This is used to check if the page viewer is authorized to view the page
function getHash() {
    const queryString = window.location.search
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('auth')
}

function getProjectId() {
    const queryString = window.location.search
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('projectid')
}