from fastapi import FastAPI
from utils import utils
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.encoders import jsonable_encoder
import copy

# Note: dir_name2dd_df itself is not returned by the API, but is used for filtering by genes and cell types
# c.f. /data/{project}/{viz} below
(dir_name2project_data, dir_name2file_name2df) = utils.get_projects()
api = FastAPI()

# List projects
@api.get("/list")
def list_projects():
    projectName2Title = dict(zip(dir_name2project_data.keys(),
                                 [x['title'] for x in dir_name2project_data.values()]))
    return projectName2Title

@api.get("/data/{project}/{viz}")
def get_viz_data(project: str,
                 viz: str,
                 genes: str = None,
                 interacting_pairs: str = None,
                 cell_types: str = None,
                 cell_type_pairs: str = None,
                 microenvironments: str = None
                 ):
    if viz == 'single_gene_expression':
        selected_genes = None
        if jsonable_encoder(genes):
            selected_genes = jsonable_encoder(genes).split(",")
        selected_cell_types = None
        if jsonable_encoder(cell_types):
            selected_cell_types = jsonable_encoder(cell_types).split(",")
        ret = copy.deepcopy(dir_name2project_data[project])
        utils.populate_deconvoluted_data(ret, dir_name2file_name2df[project]['deconvoluted_result'], selected_genes, selected_cell_types)
    elif viz == 'cell_cell_interaction_search':
        ret = copy.deepcopy(dir_name2project_data[project][viz])
        utils.filter_interactions(ret, dir_name2file_name2df[project], genes, interacting_pairs, cell_types, cell_type_pairs, microenvironments)
    else:
        ret = dir_name2project_data[project][viz]
    return ret

app = FastAPI()
# See: https://fastapi.tiangolo.com/tutorial/cors/
app.add_middleware(CORSMiddleware, allow_origins=["*"])
app.mount("/api", api)
app.mount("/", StaticFiles(directory="public", html = True), name="public")
