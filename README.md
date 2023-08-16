![CellphoneDB Viz logo](public/img/cellphonedbviz_logo.png?raw=true)

## What is CellphoneDB Viz?

CellphoneDB Viz is a software for visualising the results of either differential or statistical analyses by [CellphoneDB](https://pypi.org/project/CellphoneDB) package (version >= 4.0.0 only). 
For visualisation examples see [cellphonedb.org](https://www.cellphonedb.org/viz/index.html).

The software accepts the relevant input to and output files from a CellphoneDB analysis as well as a simple configuration yaml file telling CellphoneDB Viz which relevant files should be included in the visualisation, e.g.:
   - [data/endometrium_cpdbv5_deg/config.yml](data/endometrium_cpdbv5_deg/config.yml)
   - [data/endometrium_cpdbv5_stat/config.yml](data/endometrium_cpdbv5_stat/config.yml)
   - [data/gonads_cpdbv5_deg/config.yml](data/gonads_cpdbv5_deg/config.yml)

From the configuration file the software 'does the right thing' and produces visualisations of the data that was provided. Please see below for more information on the configuration file format.

The software consists of a web server, an API that serves the data to the front end for all the projects it knows of, and the html including the JavaScript that fetches the data from the API and visualises it in various plots.
The plots have been implemented mostly in [D3](https://d3js.org/).

The instructions below use Linux commands as an example:
## Installing CellphoneDB Viz
```shell
# Clone cellphonedbviz repository from github
git clone git@github.com:datasome/cellphonedbviz.git
```
## Adding a new project to CellphoneDB Viz
```shell
# Create a directory with a name that is meaningful to your project, e.g. my_cellphonedb_analysis
mkdir cellphonedbviz/data/my_cellphonedb_analysis
# For the sake of this example let's assume that:
# 1. Your output files are in directory e.g. ~/.cpdb/user_files/out/, 
# 2. Your input files are in ~/.cpdb/user_files/in/my_cellphonedb_analysis/, and
# 3. All the output files's names from the analysis you wish to visualise end with the suffix e.g. _08_14_2023_104434.txt :
# Copy all the output files to the target directory
cp ~/.cpdb/user_files/out/*_08_14_2023_104434.txt cellphonedbviz/data/my_cellphonedb_analysis
# Copy any relevant input files to the target directory, e.g.
cp ~/.cpdb/user_files/in/my_cellphonedb_analysis/cellphonedb.zip cellphonedbviz/data/my_cellphonedb_analysis
cp ~/.cpdb/user_files/in/my_cellphonedb_analysis/microenvironments.tsv cellphonedbviz/data/my_cellphonedb_analysis
# Create cellphonedbviz/data/my_cellphonedb_analysis/config.yml file and populate it with the relevant file names and other options (see below)
```

## Populating the yaml configuration file for a new project in CellphoneDB Viz
The following field names (in no particular order) are permitted within the configuration file.
Please see above for example configuration files, and also note red squares below for compulsory fields. Click on each field name for an example file content:
   - ![#f03c15](https://placehold.co/15x15/f03c15/f03c15.png) [analysis_means](data/endometrium_cpdbv5_deg/degs_analysis_means_08_14_2023_111234.txt)
   - [cellphonedb](data/endometrium_cpdbv5_deg/cellphonedb.zip) - this is the CellphoneDB database file you did your analysis against
   - [cellsign_active_interactions_deconvoluted](data/gonads_cpdbv5_deg/degs_analysis_CellSign_active_interactions_deconvoluted_08_01_2023_105213.txt) - this file is available from CellphoneDB v5.0.0 or later
   - [celltype_composition](data/endometrium_cpdbv5_deg/celltype_composition.tsv)
   - [deconvoluted_percents](data/gonads_cpdbv5_deg/degs_analysis_deconvoluted_percents_08_01_2023_105213.txt)
   - ![#f03c15](https://placehold.co/15x15/f03c15/f03c15.png) [deconvoluted_result](data/endometrium_cpdbv5_stat/statistical_analysis_deconvoluted_08_14_2023_105255.txt)
   - ![#f03c15](https://placehold.co/15x15/f03c15/f03c15.png) (compulsory for DEG analysis) [degs](data/endometrium_cpdbv5_deg/degs_in_epithelials.tsv)
   - hash - a value for this field can be generated via the software itself, via the following API call http://localhost:8001/api/generate/hash. When this field is present in the config file, the project's visualisation can only be accessed if the auth argument is provided in the URL containing that hash, e.g. http://localhost:8001/viz.html?projectid=endometrium_cpdbv5_deg&auth=u09AAPT-Evv4royBk1myzg
   - [interaction_scores](data/endometrium_cpdbv5_stat/statistical_analysis_interaction_scores_08_14_2023_105255.txt) - this file is available from CellphoneDB v5.0.0 or later and only when score_interactions argument in the analysis call was set to True
   - ![#f03c15](https://placehold.co/15x15/f03c15/f03c15.png) (compulsory if microenvironments were used in the analysis) [microenvironments](data/endometrium_cpdbv5_stat/microenvironments.tsv)
   - ![#f03c15](https://placehold.co/15x15/f03c15/f03c15.png) (compulsory for statistical analysis) [pvalues](data/endometrium_cpdbv5_stat/statistical_analysis_pvalues_08_14_2023_105255.txt)
   - ![#f03c15](https://placehold.co/15x15/f03c15/f03c15.png) relevant_interactions - this is [statistical_analysis_significant_means](data/endometrium_cpdbv5_stat/statistical_analysis_significant_means_08_14_2023_105255.txt) file in the case of a statistical analysis, and [degs_analysis_relevant_interactions](data/gonads_cpdbv5_deg/degs_analysis_relevant_interactions_08_01_2023_105213.txt) file in the case of DEG analysis.
   - separator - the value provided for the separator argument in CellphoneDB analysis method call, e.g. '|'
   - ![#f03c15](https://placehold.co/15x15/f03c15/f03c15.png) title - the analysis title to be shown at the top of the analysis visualisation page.

## Deploying CellphoneDB Viz web service
```shell
# Create Docker image
docker-compose build --no-cache
# Deploy the image in a Docker container
docker-compose up -d
# Shut down the Docker container when you no longer need the service
docker-compose down
```
## Accessing projects in CellphoneDB Viz web service
   - http://localhost:8001/ shows all the projects you included in CellphoneDB Viz, including the example ones that came with the software
   - Please remember that if you specified a hash in config file, you cannot just click on that project's link on http://localhost:8001/ - you need to access it via a url that specifies the hash as a value of auth parameter, e.g. http://localhost:8001/viz.html?projectid=endometrium_cpdbv5_deg&auth=u09AAPT-Evv4royBk1myzg

## Caveats and restrictions
   - To the author's current knowledge, there is no theoretical maximum on the number of projects that can be included in a single CellphoneDB Viz web service so long as the service's memory footprint stays within that available on the server it is running on.
   - Currently, up to maximum nine microenvironments can be visualised together within 'Cell-cell Communication - Summary' section. However, the user is able to select subsets of microenvironments to visualise - in order to get round this restriction.

## Software Support
Please report any issues you have with running the software via [https://github.com/datasome/cellphonedbviz/issues](https://github.com/datasome/cellphonedbviz/issues).