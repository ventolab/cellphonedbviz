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
                 classes: str = None,
                 modalities: str = None,
                 min_score: str = 0,
                 cell_types: str = None,
                 cell_type_pairs: str = None,
                 microenvironments: str = None,
                 refresh_plot: bool = False,
                 values_to_show: str = 'means',
                 interacting_pairs_selection_logic: str = None,
                 sort_interacting_pairs_alphabetically: bool = False
                 ):
    if viz == 'single_gene_expression':
        selected_genes = get_jsonable(genes)
        selected_cell_types = get_jsonable(cell_types)
        ret = copy.deepcopy(dir_name2project_data[project])
        utils.populate_deconvoluted_data(ret, dir_name2file_name2df[project]['deconvoluted_result'], \
                                         selected_genes = selected_genes, selected_cell_types = selected_cell_types,
                                         refresh_plot = refresh_plot, percents = False)
        dict_sge = ret['single_gene_expression']
        if 'deconvoluted_percents' in dir_name2file_name2df[project]:
            utils.populate_deconvoluted_data(ret, dir_name2file_name2df[project]['deconvoluted_percents'], \
                                             # The following ensures that the same genes and cell types are used to
                                             # filter deconvoluted_percents as were used to filter deconvoluted_result
                                             selected_genes=dict_sge['genes'], \
                                             selected_cell_types=dict_sge['cell_types'], \
                                             refresh_plot=refresh_plot, percents = True)
        if refresh_plot:
            # Autocompletes are initialised on first load only - hence on refresh_plot we avoid
            # bulking-up the API output unnecessarily
            dict_sge.pop('all_genes')
        ret = dict_sge

    elif viz == 'cell_cell_interaction_search':
        selected_genes = get_jsonable(genes)
        selected_interacting_pairs = get_jsonable(interacting_pairs)
        selected_cell_types = get_jsonable(cell_types)
        selected_cell_type_pairs = get_jsonable(cell_type_pairs)
        selected_microenvironments = get_jsonable(microenvironments)
        selected_classes = get_jsonable(classes)
        selected_modalities = get_jsonable(modalities)
        ret = copy.deepcopy(dir_name2project_data[project][viz])
        if refresh_plot:
            # Autocompletes are initialised on first load only - hence on refresh_plot
            # we avoid bulking-up the API output unnecessarily
            ret.pop('all_genes')
            ret.pop('all_interacting_pairs')
        utils.filter_interactions_for_cci_search(ret, dir_name2file_name2df[project],
                                  selected_genes, selected_interacting_pairs, selected_classes, selected_cell_types,
                                  selected_cell_type_pairs, selected_microenvironments, refresh_plot, values_to_show,
                                  interacting_pairs_selection_logic, sort_interacting_pairs_alphabetically)
        # 'analysis_means' is used for pre-selecting interacting pairs - it is not needed by the front end
        ret.pop('analysis_means')
        # cellphonedb is needed for retrieving properties of interacting pairs but it is not used by the front end directly
        if 'cellphonedb' in ret:
            ret.pop('cellphonedb')
    elif viz == 'cell_cell_interaction_summary':
        selected_classes = get_jsonable(classes)
        selected_modalities = get_jsonable(modalities)
        ret = copy.deepcopy(dir_name2project_data[project][viz])
        utils.filter_interactions_for_cci_summary(ret, dir_name2file_name2df[project], selected_classes, selected_modalities, int(min_score))
    else:
        ret = dir_name2project_data[project][viz]
    return ret

@api.get("/generate/hash")
def generate_random_hash() -> str:
    return utils.generate_random_hash()

@api.get("/validate/{project_id}")
def validate_projectid(project_id: str) -> bool:
    ret = False
    if project_id in dir_name2project_data:
        ret = True
    return ret

@api.get("/validate/auth/{project_id}")
def validate_auth(project_id: str, auth: str) -> bool:
    ret = False
    if 'hash' in dir_name2project_data[project_id]:
            if hash is not None and auth == dir_name2project_data[project_id]['hash']:
                ret = True
    else:
        ret = True
    return ret

def get_jsonable(val: str) -> list:
    ret = []
    if jsonable_encoder(val):
        ret = jsonable_encoder(val).split(",")
    return ret

app = FastAPI()
# See: https://fastapi.tiangolo.com/tutorial/cors/
app.add_middleware(CORSMiddleware, allow_origins=["*"])
app.mount("/api", api)
app.mount("/", StaticFiles(directory="public", html = True), name="public")
