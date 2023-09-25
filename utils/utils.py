import os
import pandas as pd
import numpy as np
from scipy import stats
import yaml
import re
from collections import OrderedDict
import secrets
from cellphonedb.utils import db_utils, search_utils
import copy

base_path = os.path.dirname(os.path.realpath(__file__))
DATA_ROOT = f"{base_path}/../data"
CONFIG_KEYS = ['title','cell_type_data','lineage_data','celltype_composition','microenvironments', \
               'analysis_means', 'relevant_interactions', 'interaction_scores', \
               'deconvoluted_result','deconvoluted_percents','degs','pvalues', \
               'cellsign_active_interactions_deconvoluted', 'hash', 'anatomogram','cellphonedb']
VIZZES = ['celltype_composition','microenvironments','single_gene_expression', \
          'cell_cell_interaction_summary','cell_cell_interaction_search']
MAX_NUM_STACKS_IN_CELLTYPE_COMPOSITION= 6
SIDENAV_PROPERTY_STYLE = "style=\"padding-left: 60px; font-size: 14px; margin: 20px 0px !important; \""
SANKEY_EDGE_WEIGHT = 30
INDENT="     "

def get_projects() -> dict:
    dir_name2project_data = {}
    dir_name2file_name2df = {}
    project_dirs = None
    for root, dirs, files in os.walk(DATA_ROOT):
        if not project_dirs:
            project_dirs = dirs
        else:
            dir_name = root.split("/")[-1]
            if dir_name in project_dirs:
                dict = {}
                dir_name2file_name2df[dir_name] = {}
                print("\nLoading project: {}".format(dir_name), flush=True, end="")
                with open('{}/config.yml'.format(root), 'r') as file:
                    config = yaml.safe_load(file)
                    dict['title'] = config['title']
                    for key in CONFIG_KEYS[3:]:
                        if key in config:
                            if key == 'anatomogram':
                                fpath = "{}/{}".format(root, config[key])
                                with open(fpath, 'rb') as f:
                                    # NB. We're using celltype_composition only
                                    # temporarily for testing anatomograms
                                    dict['celltype_composition'][key] = f.read()
                            elif key not in ['hash', 'cellphonedb']:
                                print("\n{}Loading {} for project: {}".format(INDENT, key, dir_name), flush=True, end="")
                                fpath = "{}/{}".format(root, config[key])
                                df = pd.read_csv(fpath, sep='\t', low_memory=False)
                                populate_data4viz(key, dict, df, config['separator'], dir_name2file_name2df[dir_name])
                            elif key == 'hash':
                                dict[key] = config[key]
                            elif key == 'cellphonedb':
                                fpath = "{}/{}".format(root, config[key])
                                protein2Info, complex2Info, resource2Complex2Acc, proteinAcc2Name = \
                                    db_utils.get_protein_and_complex_data_for_web(fpath)
                                dict['cell_cell_interaction_search'][key] = {'protein2Info': protein2Info,
                                             'complex2Info': complex2Info,
                                             'resource2Complex2Acc': resource2Complex2Acc,
                                             'proteinAcc2Name': proteinAcc2Name}
                    dict['cell_cell_interaction_summary']['separator'] = config['separator']
                    dict['cell_cell_interaction_search']['separator'] = config['separator']
                    dir_name2project_data[dir_name] = dict
    return (dir_name2project_data, dir_name2file_name2df)

def populate_data4viz(config_key, result_dict, df, separator, file_name2df):
    for viz in VIZZES:
        if viz not in result_dict:
            result_dict[viz] = {}
    if config_key == 'celltype_composition':
        populate_celltype_composition_data(result_dict, df)
    elif config_key == 'microenvironments':
        populate_microenvironments_data(result_dict, df)
    elif config_key == 'analysis_means':
        populate_analysis_means_data(result_dict, df, separator)
    elif config_key == 'relevant_interactions':
        populate_relevant_interactions_data(result_dict, df, separator)
    elif config_key == 'interaction_scores':
        populate_interaction_scores_data(result_dict, df, separator)
    elif config_key == 'deconvoluted_result':
        populate_deconvoluted_data(result_dict, df, separator, percents=False)
    elif config_key == 'deconvoluted_percents':
        populate_deconvoluted_data(result_dict, df, separator, percents=True)
    elif config_key == 'degs':
        populate_degs_data(result_dict, df)
    elif config_key == 'pvalues':
        populate_pvalues_data(result_dict, df, separator)
    elif config_key == 'cellsign_active_interactions_deconvoluted':
        populate_cellsign_active_interactions_deconvoluted(result_dict, df)
    if config_key in ['deconvoluted_result', 'analysis_means','deconvoluted_percents']:
        file_name2df[config_key] = df

def populate_microenvironments_data(result_dict, df):
    me_col_name = 'microenvironment'
    ct_col_name = 'cell_type'
    dict_me = result_dict['microenvironments']
    dict_sge = result_dict['single_gene_expression']
    dict_cci_summary = result_dict['cell_cell_interaction_summary']
    dict_cci_search = result_dict['cell_cell_interaction_search']
    # Data for filtering of cell types by micro-environment in single gene expression plot
    if 'microenvironments' in result_dict:
        # N.B. The following is for spme plot only - to connect micro-environment legend to cell types
        dict_me['raw_data'] = df.values.tolist()
        # If micro-environments, set colour domain to microenviroments; otherwise 'color_domain' is not set
        dict_me['color_domain'] = sorted(list(set(df[me_col_name].values)))
        dict_sge['microenvironments'] = sorted(list(set(df[me_col_name].values)))
        dict_cci_search['microenvironments'] = dict_sge['microenvironments']
        dict_cci_summary['microenvironments'] = dict_sge['microenvironments']
        dict_sge['microenvironment2cell_types'] = {}
        dict_cci_search['cell_type2microenvironments'] = {}
        for i, j in zip(df[me_col_name].values.tolist(), df[ct_col_name].values.tolist()):
            dict_sge['microenvironment2cell_types'].setdefault(i, []).append(j)
        for i, j in zip(df[ct_col_name].values.tolist(), df[me_col_name].values.tolist()):
            dict_cci_search['cell_type2microenvironments'].setdefault(i, []).append(j)
        dict_cci_summary['cell_type2microenvironments'] = dict_cci_search['cell_type2microenvironments']
        dict_cci_summary['microenvironment2cell_types'] = dict_sge['microenvironment2cell_types']
        dict_cci_search['microenvironment2cell_types'] = dict_sge['microenvironment2cell_types']

    # Data for Spatial micro-environments plot
    dict_me['y_vals'] = sorted(list(set(df[ct_col_name].values)))
    dict_me['x_vals'] = sorted(list(set(df[me_col_name].values)))

def populate_celltype_composition_data(result_dict, df):
    dict_cc = result_dict['celltype_composition']
    dict_cc['title'] = ' - '.join(df.columns.values)
    edges = set([])
    stacks = []
    all_elems = set([])
    for row in df.values:
        prev_item = None
        stack_idx = 0
        for item in row:
            if not stacks:
                stacks = [set([]) for x in range(MAX_NUM_STACKS_IN_CELLTYPE_COMPOSITION)]
            stacks[stack_idx].add(item)
            all_elems.add(item)
            stack_idx += 1
            if prev_item is not None:
                edges.add((prev_item, SANKEY_EDGE_WEIGHT, item))
            prev_item = item
    # dict_cc['num_stacks'] is used for working out the left margin of Cell composition plot
    dict_cc['num_stacks'] = stack_idx
    dict_cc['edges'] = [list(x) for x in edges]
    dict_cc['all_elems'] = list(sorted(all_elems))
    for idx, items in enumerate(stacks):
        dict_cc['list{}'.format(idx)] = sorted(list(items))
        if items:
            y_space = int(450 / len(items))
            y_box = int(200 / len(items))
        else:
            y_space, y_box = 0, 0
        dict_cc['y_space{}'.format(idx)] = y_space
        dict_cc['y_box{}'.format(idx)] = y_box

def get_cell_type_pairs(df, separator):
    cell_type_pairs = []
    first_separator_found = False
    for i, ctp in enumerate(list(df.columns)):
        if first_separator_found or separator in ctp:
            cell_type_pairs.append(ctp)
            first_separator_found = True
    return cell_type_pairs

def populate_analysis_means_data(dict_dd, df, separator):
    dict_cci_summary = dict_dd['cell_cell_interaction_summary']
    dict_cci_search = dict_dd['cell_cell_interaction_search']
    all_cell_types_combinations = get_cell_type_pairs(df, separator)

    # Collect all cell types and their indexes for the purpose of per-microenvironment cci_summary plots
    all_cell_types = set([])
    for ct_pair in all_cell_types_combinations:
        all_cell_types.update(ct_pair.split(separator))
    all_cell_types = sorted(list(all_cell_types))
    ct2indx = dict([(ct, all_cell_types.index(ct)) for ct in all_cell_types])
    dict_cci_summary['all_cell_types'] = all_cell_types
    dict_cci_summary['ct2indx'] = ct2indx

    # Collect all cell types and their indexes for the purpose of 'all cell types' cci_summary plots -
    # in which cell type labels are grouped per microenvironment - if microenvironments were provided
    if 'microenvironment2cell_types' in dict_cci_summary:
        cell_types_for_sortedbyme = []
        # The set is just used to speed up building cell_types_for_sortedbyme
        cell_types_for_sortedbyme_set = set([])
        # Order cell types by microenvironment so that they appear clustered in the cci_summary plot
        # Note that a cell type can occur in multiple microenvironments, but it is shown only once in cci_summary
        # hence we include it in the first microenvironment we come across (and ignore it in the subsequent ones)
        for me in dict_cci_summary['microenvironment2cell_types']:
            for ct in dict_cci_summary['microenvironment2cell_types'][me]:
                if ct not in cell_types_for_sortedbyme_set:
                    cell_types_for_sortedbyme.append(ct)
                    cell_types_for_sortedbyme_set.add(ct)
    else:
        cell_types_for_sortedbyme = all_cell_types
    dict_cci_summary['all_cell_types_for_sortedbyme'] = cell_types_for_sortedbyme
    ct_sortedbyme2indx = dict([(ct, cell_types_for_sortedbyme.index(ct)) for ct in cell_types_for_sortedbyme])
    dict_cci_summary['ct_sortedbyme2indx'] = ct_sortedbyme2indx

    # Data below is needed for autocomplete functionality
    dict_cci_search['all_cell_type_pairs'] = sorted(all_cell_types_combinations)
    # num_all_cell_type_pairs is used for warning the user that if they select all cell type pairs and
    # all relevant interactions for the cci_search plot, the browser may run out of memory and crash
    dict_cci_search['num_all_cell_type_pairs'] = len(dict_cci_search['all_cell_type_pairs'])
    df_ips = df[df.columns.intersection(['interacting_pair'] + all_cell_types_combinations)].copy()
    df_ips.set_index('interacting_pair', inplace=True)
    # We need df_ips to be able to select top N interacting pairs based on the selected cell type pairs
    dict_cci_search['analysis_means'] = df_ips
    # Assign to 'all_interacting_pairs' key the list of interacting pairs sorted by the highest aggregated
    # across all cell type pairs means
    dict_cci_search['all_interacting_pairs'] = df_ips.sum(axis=1).sort_values(ascending=False).index.tolist()
    # On first page load, we pre-select N interacting pairs (from means file), but we can map each interacting
    # pair label to a pair of gene names using deconvoluted file (via interaction id - shared by deconvoluted and means files - hence the dict below
    dict_cci_search['interaction_id2interacting_pair'] = {}
    for i, j in zip(df['id_cp_interaction'].values.tolist(), df['interacting_pair'].values.tolist()):
        dict_cci_search['interaction_id2interacting_pair'][i] = j
    dict_cci_search['interacting_pair2properties'] = {}
    for ip, properties in zip(df['interacting_pair'].values.tolist(), df[['secreted', 'receptor_a', 'receptor_b', 'is_integrin']].values.tolist()):
        if ip not in dict_cci_search['interacting_pair2properties']:
            dict_cci_search['interacting_pair2properties'][ip] = {}
        for i, property_name in enumerate(['secreted', 'receptor_a', 'receptor_b', 'is_integrin']):
            dict_cci_search['interacting_pair2properties'][ip][property_name] = properties[i]
    # Data used for filtering cci_summary and cci_search plots by class of interacting pair
    if 'classification' in df.columns:
        class2interacting_pairs = {}
        # interacting_pair2classes is used for populating sidenav with interaction info
        interacting_pair2classes = {}
        for i, j in zip(df['classification'].values.tolist(), df['interacting_pair'].values.tolist()):
            if str(i) != "nan":
                # Only store if class (i) was provided for interacting pair j
                class2interacting_pairs.setdefault(i, set([])).add(j)
                interacting_pair2classes[j] = i
        dict_cci_summary['class2interacting_pairs'] = class2interacting_pairs
        dict_cci_search['class2interacting_pairs'] = class2interacting_pairs
        dict_cci_search['interacting_pair2classes'] = interacting_pair2classes
        all_classes = sorted(class2interacting_pairs.keys())
        dict_cci_summary['all_classes'] = all_classes
        dict_cci_search['all_classes'] = all_classes

def get_all_relevant_interactions(dict_cci_search: dict, selected_cell_type_pairs):
    rel_ints_dict = dict_cci_search['relevant_interactions']
    relevant_interactions_set = set([])
    for ctp in selected_cell_type_pairs:
        if ctp in rel_ints_dict:
            if ctp in rel_ints_dict:
                relevant_interactions_set.update(rel_ints_dict[ctp].keys())
    return relevant_interactions_set

def preselect_interacting_pairs(dict_cci_search: dict, selected_cell_type_pairs, interacting_pairs_selection_logic: str):
    relevant_interactions_set = get_all_relevant_interactions(dict_cci_search, selected_cell_type_pairs)
    df_ips = dict_cci_search['analysis_means'][selected_cell_type_pairs]
    selected_interacting_pairs_sorted = \
        df_ips[df_ips[selected_cell_type_pairs].apply(lambda row: row.sum() > 0, axis=1)].max(axis=1).sort_values(ascending=False).index.tolist()
    # Filter selected_interacting_pairs_sorted by interactions in relevant_interactions_set
    selected_interacting_pairs_sorted = [ip for ip in selected_interacting_pairs_sorted if ip in relevant_interactions_set]
    if interacting_pairs_selection_logic == "all":
        return selected_interacting_pairs_sorted
    else:
        topN = int(interacting_pairs_selection_logic)
        return selected_interacting_pairs_sorted[0:topN]

def maxCellTypePairsExceeded(dd):
    return dd['num_all_cell_type_pairs'] >= 1500

def preselect_cell_types_pairs(dict_cci_search: dict, separator: str, mes: set):
    if maxCellTypePairsExceeded(dict_cci_search):
        if 'microenvironment2cell_types' in dict_cci_search:
            dd = dict_cci_search['microenvironment2cell_types']
            if not mes:
                me = list(dd.keys())[0]
                mes.add(me)
            cell_type_pairs = []
            cell_types = []
            for me in mes:
                cts = dd[me]
                for ct_pair in dict_cci_search['all_cell_type_pairs']:
                    (ct1, ct2) = ct_pair.split(separator)
                    if ct1 in cts and ct2 in cts:
                        cell_type_pairs += [ct_pair]
                        cell_types += cts
            return cell_types, cell_type_pairs
        else:
            return dict_cci_search['all_cell_types'], dict_cci_search['all_cell_type_pairs']
    else:
        return dict_cci_search['all_cell_types'], dict_cci_search['all_cell_type_pairs']

def add_naive_regexes(all_genes: set) -> set:
    ret = set()
    for n in [3, 4]:
        ret.update(set([g[0:n]+"*" for g in all_genes]))
    ret.update(all_genes)
    return ret


def populate_deconvoluted_data(dict_dd, df, separator = None, selected_genes = None, selected_cell_types = None, refresh_plot = False, percents = False):
    dict_sge = dict_dd['single_gene_expression']
    dict_cci_search = dict_dd['cell_cell_interaction_search']
    if not separator:
        separator = dict_dd['cell_cell_interaction_search']['separator']

    # Note: all_genes is needed for autocomplete - for the user to include genes in the plot
    all_genes = set(df['gene_name'].values)
    # Add simplified regular expression terms (e.g. WNT*) - to allow the user to select gene families
    all_genes = add_naive_regexes(all_genes)
    all_cell_types = list(df.columns[7:])
    # Data below is needed for autocomplete functionality
    dict_sge['all_genes'] = all_genes
    dict_sge['all_cell_types'] = all_cell_types
    dict_cci_search['all_genes'] = all_genes
    dict_cci_search['all_cell_types'] = all_cell_types

    # On first page load, we pre-select N interacting pairs (from means file), but we can map each interacting
    # pair label to a pair of gene names using deconvoluted file (via interaction id - shared by deconvoluted and means files -
    # hence the need for interacting_pair2genes_names
    interacting_pair2genes_names = {}
    for i, j in zip(df['id_cp_interaction'].values.tolist(), df['gene_name'].values.tolist()):
        if i in dict_cci_search['interaction_id2interacting_pair']:
            interacting_pair = dict_cci_search['interaction_id2interacting_pair'][i]
            interacting_pair2genes_names.setdefault(interacting_pair, set([])).add(j)

    if not selected_cell_types:
        if not refresh_plot:
            # Pre-select cell type pairs
            selected_cell_types, selected_cell_type_pairs = preselect_cell_types_pairs(dict_cci_search, separator, set())
        else:
            selected_cell_types = []
    selected_cell_types = sorted(list(set(selected_cell_types)))
    dict_sge['cell_types'] = selected_cell_types

    if not selected_genes:
        if not refresh_plot:
            # Pre-select interacting_pairs - note that top 10 (by max mean in any of selected_cell_type_pairs) is the
            # default interacting pairs selection strategy
            selected_interacting_pairs = preselect_interacting_pairs(dict_cci_search, selected_cell_type_pairs, "10")
            selected_genes = set([])
            # Derive pre-selected genes from the pre-selected interacting_pairs
            for ip in selected_interacting_pairs:
                selected_genes.update(interacting_pair2genes_names[ip])
            selected_genes = sorted(list(selected_genes))
        else:
            selected_genes = []
    dict_sge['genes'] = selected_genes

    # Retrieve gene and complex information for each interacting pair
    interacting_pair2participants = {}
    if not percents:
        # We need to do this once only - hence not when percents are retrieved
        for row in df[['id_cp_interaction', 'gene_name', 'uniprot', 'protein_name', 'complex_name']].fillna('').values:
            interaction_id = row[0]
            interacting_pair = dict_cci_search['interaction_id2interacting_pair'][interaction_id]
            if interacting_pair not in interacting_pair2participants:
                interacting_pair2participants[interacting_pair] = []
            interacting_pair2participants[interacting_pair].append([str(i) for i in row[1:]])
        dict_cci_search['interacting_pair2participants'] = interacting_pair2participants

    # Retrieve means for genes in selected_genes and cell types in all_cell_types
    selected_genes_means_or_pcts_df = df[df['gene_name'].isin(selected_genes)][['gene_name', 'complex_name'] + selected_cell_types].drop_duplicates()
    if percents:
        deconvoluted_df = selected_genes_means_or_pcts_df[selected_cell_types]
        key = 'percents'
        min_key = 'min_percent'
        max_key = 'max_percent'
        # Drop all rows/genes with all zeros in them - to match deconvoluted_df.dropna for z-scores below
        deconvoluted_df = deconvoluted_df.loc[~(deconvoluted_df == 0).all(axis=1)]
    else:
        deconvoluted_df = selected_genes_means_or_pcts_df
        # Calculate z-scores (so that cell types per gene complex are comparable)
        deconvoluted_df.set_index(['gene_name', 'complex_name'], inplace=True)
        if not deconvoluted_df.empty:
            # If at least one cell type was selected
            deconvoluted_df = stats.zscore(deconvoluted_df, axis=1)
        # Genes with expression=0 across all selected_cell_types will get z-score = nan - remove
        # them from the plot
        deconvoluted_df.dropna(axis=0, inplace=True)
        # Round zscores to 3 decimal places
        deconvoluted_df = np.round(deconvoluted_df, 3)
        deconvoluted_df.reset_index(drop=False, inplace=True)
        # Assemble gene_complex_list with the genes remaining in mean_zscores
        gene_complex_list = (deconvoluted_df['gene_name'] + " in " + deconvoluted_df['complex_name'].fillna('')).values
        gene_complex_list = [re.sub(r"\sin\s$", "", x) for x in gene_complex_list]
        dict_sge['gene_complex'] = gene_complex_list
        deconvoluted_df.drop(columns=['gene_name', 'complex_name'], inplace=True)
        key = 'mean_zscores'
        min_key = 'min_zscore'
        max_key = 'max_zscore'
    dict_sge[key] = deconvoluted_df.values.tolist()
    if not deconvoluted_df.empty:
        dict_sge[min_key] = deconvoluted_df.min(axis=None)
        dict_sge[max_key] = deconvoluted_df.max(axis=None)

def populate_pvalues_data(result_dict, df, separator):
    dict_cci_search = result_dict['cell_cell_interaction_search']
    dict_pvals = {}
    all_cell_types_combinations = get_cell_type_pairs(df, separator)
    cnt = 0
    for ct_pair in all_cell_types_combinations:
        # Filter out pvals = 1.0 - no point bloating the API call result
        df_filtered = df[['interacting_pair', ct_pair]][df[ct_pair] < 1]
        if cnt % 100000 == 0:
            print('.', flush=True, end="")
        if not df_filtered.empty:
            dict_pvals[ct_pair] = dict(zip(df_filtered['interacting_pair'], df_filtered[ct_pair]))
        cnt += 1
    dict_cci_search['pvalues'] = dict_pvals

def populate_relevant_interactions_data(result_dict, df, separator):
    dict_cci_search = result_dict['cell_cell_interaction_search']
    dict_ri_flags = {}
    all_cell_types_combinations = get_cell_type_pairs(df, separator)
    cnt = 0
    for ct_pair in all_cell_types_combinations:
        # Filter out values of 0 (= irrelevant interactions) - no point bloating the API call result
        df_filtered = df[['interacting_pair', ct_pair]][df[ct_pair] > 0]
        if cnt % 100000 == 0:
            print('.', flush=True, end="")
        if not df_filtered.empty:
            dict_ri_flags[ct_pair] = dict(zip(df_filtered['interacting_pair'], df_filtered[ct_pair]))
        cnt += 1
    dict_cci_search['relevant_interactions'] = dict_ri_flags

def populate_interaction_scores_data(result_dict, df, separator):
    dict_cci_summary = result_dict['cell_cell_interaction_summary']
    dict_cci_search = result_dict['cell_cell_interaction_search']
    dict_int_scores = {}
    all_cell_types_combinations = get_cell_type_pairs(df, separator)
    cnt = 0
    for ct_pair in all_cell_types_combinations:
        # Filter out scores of 0 - no point bloating the API call result
        df_filtered = df[['interacting_pair', ct_pair]][df[ct_pair] > 0]
        if cnt % 100000 == 0:
            print('.', flush=True, end="")
        if not df_filtered.empty:
            dict_int_scores[ct_pair] = dict(zip(df_filtered['interacting_pair'], df_filtered[ct_pair]))
        cnt += 1
    dict_cci_summary['interaction_scores'] = dict_int_scores
    dict_cci_search['interaction_scores'] = dict_int_scores

def populate_degs_data(result_dict, df):
    dict_degs = result_dict['single_gene_expression']
    degs_cell_types = list(zip(df['gene'], df['cluster']))
    cell_type2degs = {}
    for (deg, cell_type) in degs_cell_types:
        if cell_type not in cell_type2degs:
            cell_type2degs[cell_type] = set([])
        cell_type2degs[cell_type].add(deg)
    # Convert sets to lists
    for (cell_type, degs) in cell_type2degs.items():
        cell_type2degs[cell_type] = list(degs)
    dict_degs['celltype2degs'] = cell_type2degs

def populate_cellsign_active_interactions_deconvoluted(result_dict, df):
    dict_cci_search = result_dict['cell_cell_interaction_search']
    dict_active_interactions = {}
    all_active_interactions = list(zip(df['interacting_pair'], df['celltype_pairs'], df['active_TF'], df['active_celltype']))
    for t in all_active_interactions:
        interacting_pair = t[0]
        cell_type_pair = t[1]
        active_TF = t[2]
        active_celltype = t[3]
        if interacting_pair not in dict_active_interactions:
            dict_active_interactions[interacting_pair] = {}
        if cell_type_pair not in dict_active_interactions[interacting_pair]:
            dict_active_interactions[interacting_pair][cell_type_pair] = []
        dict_active_interactions[interacting_pair][cell_type_pair].append((active_TF, active_celltype))
    dict_cci_search['cellsign_active_interactions'] = dict_active_interactions

def sort_cell_type_pairs(cell_type_pairs, result_dict, separator) -> (list, dict):
    if 'cell_type2microenvironments' not in result_dict:
        selected_cell_type_pairs = sorted(cell_type_pairs)
        ct_pair2me = {ctp: 'all' for ctp in selected_cell_type_pairs}
        return selected_cell_type_pairs, ct_pair2me
    else:
        ct2mes = result_dict['cell_type2microenvironments']
        # Microenvironments are used - sort selected_cell_type_pairs by microenvironment
        ct_pair2me = {}
        me2ct_pairs = {}
        for ct_pair in cell_type_pairs:
            ct1 = ct_pair.split(separator)[0]
            ct2 = ct_pair.split(separator)[1]
            mes1 = ct2mes[ct1]
            mes2 = ct2mes[ct2]
            if len(mes1) == 1 and mes1[0] in mes2:
                me = mes1[0]
            elif len(mes2) == 1 and mes2[0] in mes1:
                me = mes2[0]
            else:
                me = 'multiple'
            ct_pair2me[ct_pair] = me
            if me not in me2ct_pairs:
                me2ct_pairs[me] = set([])
            me2ct_pairs[me].add(ct_pair)
        # Collate ct_pair2me.keys into a single list (sorted_selected_cell_type_pairs)
        # sorting cell type pairs within each micro-environment alphabetically
        sorted_selected_cell_type_pairs = []
        for me in OrderedDict(sorted(me2ct_pairs.items())):
            sorted_selected_cell_type_pairs += sorted(list(me2ct_pairs[me]))
        return sorted_selected_cell_type_pairs, ct_pair2me
def get_properties_html_for_interacting_pairs(result_dict: dict) -> dict:
    interacting_pairs = result_dict['interacting_pairs_means']
    interacting_pair2properties_html = {}
    cpdb_data = result_dict['cellphonedb']
    protein2Info = cpdb_data['protein2Info']
    complex2Info = cpdb_data['complex2Info']
    resource2Complex2Acc = cpdb_data['resource2Complex2Acc']
    proteinAcc2Name = cpdb_data['proteinAcc2Name']
    interacting_pair2participants = result_dict['interacting_pair2participants']
    for ip in interacting_pairs:
        html = "<ul id=\"sidenav_{}\" class=\"sidenav fixed\" style=\"width:410px\">".format(ip)
        if 'interacting_pair2classes' in result_dict and ip in result_dict['interacting_pair2classes']:
            classes = result_dict['interacting_pair2classes'][ip]
            html += "<li><a class=\"subheader black-text\">Interaction classification</a></li>" + \
                    "<a {}>{}</a><br> ".format(SIDENAV_PROPERTY_STYLE, classes)
            html += "<li><div class=\"divider\"></div></li>"
        complex_name2proteins = {}
        partners = [None, None]
        partner_letters = "ab"
        i = 0
        for (geneName, uniprotAcc, proteinName, complexName) in interacting_pair2participants[ip]:
             pos = min(i, 1)
             if complexName != '':
                partners[pos] = complexName
                if complexName not in complex_name2proteins:
                    complex_name2proteins[complexName] = []
                    complex_name2proteins[complexName].append(uniprotAcc)
             else:
                 partners[pos] = uniprotAcc
             i += 1
        if partners[1] is None:
            # E.g. GJA1_GJA1 - protein interacts with the same protein in a different cell
            partners[1] = partners[0]
        for i, partner in enumerate(partners):
            if i > 0:
                html += "<li><div class=\"divider\"></div></li>"
            html += "<li><a class=\"subheader black-text\">Partner {} </a></li>".format(partner_letters[i])
            html += search_utils.get_sidenav_html(partner in complex_name2proteins, partner, complex_name2proteins, protein2Info,
                                                   complex2Info, resource2Complex2Acc, proteinAcc2Name)
        html += "<li><div class=\"divider\"></div></li>"
        html += "</ul></td>"
        interacting_pair2properties_html[ip] = html
    return interacting_pair2properties_html

def filter_interactions_for_cci_search(result_dict,
                        file_name2df,
                        genes,
                        interacting_pairs,
                        classes,
                        cell_types,
                        cell_type_pairs,
                        microenvironments,
                        refresh_plot,
                        values_to_show,
                        interacting_pairs_selection_logic,
                        sort_interacting_pairs_alphabetically):
    means_df = file_name2df['analysis_means']
    deconvoluted_df = file_name2df['deconvoluted_result']
    separator = result_dict['separator']

    if 'cell_type2microenvironments' not in result_dict:
        selected_cell_type_pairs = sorted(cell_type_pairs)
        ct2mes = {ctp: 'all' for ctp in selected_cell_type_pairs}
    else:
        ct2mes = result_dict['cell_type2microenvironments']

    # Collect all combinations of cell types (disregarding the order) from cell_types and cell_type_pairs combined
    mes = set(microenvironments)
    if cell_types:
        selected_cell_types = cell_types
        # Derive selected_cell_type_pairs from selected_cell_types
        selected_cell_type_pairs = []
        if cell_type_pairs:
            # Note: the search for cell types and cell type pairs is additive (inclusive OR)
            selected_cell_type_pairs += cell_type_pairs
        # Extract from result_dict['all_cell_type_pairs'] all elements containing at least one cell type in selected_cell_types
        for ct_pair in result_dict['all_cell_type_pairs']:
            (ct1, ct2) = ct_pair.split(separator)
            if not microenvironments:
                if ct1 in selected_cell_types or ct2 in selected_cell_types:
                    selected_cell_type_pairs += [ct_pair]
            else:
                # Allow for cell type pairs in which both cell types' respective microenvironments intersect with microenvironments call argument
                if any(i in ct2mes[ct1] for i in mes) and any(i in ct2mes[ct2] for i in mes):
                    selected_cell_type_pairs += [ct_pair]
        # Restrict all combinations of cell types to just those in means_df
        selected_cell_type_pairs = [ct_pair for ct_pair in selected_cell_type_pairs if ct_pair in means_df.columns.values]
    elif not cell_type_pairs:
        selected_cell_types, selected_cell_type_pairs = preselect_cell_types_pairs(result_dict, separator, mes)
    else:
        selected_cell_types = []
        selected_cell_type_pairs = cell_type_pairs
    if not selected_cell_type_pairs:
        # Nothing sensible can be plotted
        return

    means_cols_filter = means_df.columns[means_df.columns.isin(selected_cell_type_pairs)]
    result_dict['selected_cell_types'] = sorted(selected_cell_types)
    selected_cell_type_pairs, ctp2me = sort_cell_type_pairs(selected_cell_type_pairs, result_dict, separator)

    if maxCellTypePairsExceeded(result_dict):
        if not microenvironments:
            if 'microenvironment2cell_types' in result_dict:
                dd = result_dict['microenvironment2cell_types']
                me = list(dd.keys())[0]
                # The following is in an attempt to avoid exceeding max length of GET request - if microenvironments (me's) are present, the
                # first me key in dd is populated into the page _instead_ of selected_cell_type_pairs
                result_dict['selected_microenvironments'] = [me]
    if not 'selected_microenvironments' in result_dict:
        result_dict['selected_microenvironments'] = microenvironments
    result_dict['selected_cell_type_pairs'] = selected_cell_type_pairs

    # The following will be used to colour cell type pair labels on the plot's x-axis depending on
    # micro-environment they _both_ belong to.
    result_dict['selected_cell_type_pairs2microenvironment'] = ctp2me
    # Collect all interactions from query_genes and query_interactions
    interactions = set([])
    if interacting_pairs_selection_logic is not None:
        # If the user has selected a specific logic for retrieval of interacting_pairs based on selected_cell_type_pairs,
        # then ignore the current selected interacting_pairs
        interacting_pairs = []
        genes = []
        classes = []
    if not genes and not interacting_pairs and not classes:
        if not refresh_plot:
            # If neither genes nor interactions are selected on first page load, pre-select top 10 interacting pairs
            interacting_pairs = preselect_interacting_pairs(result_dict, selected_cell_type_pairs, "10")
        elif interacting_pairs_selection_logic is not None:
            # The plot is being refreshed but the user has selected an interacting_pairs_selection_logic
            interacting_pairs = preselect_interacting_pairs(result_dict, selected_cell_type_pairs, interacting_pairs_selection_logic)
        else:
            interacting_pairs = []
    else:
        # Select interacting pairs belonging to a class in classes
        if classes:
            for c in classes:
                interacting_pairs.extend(result_dict['class2interacting_pairs'][c])
        if genes:
            interaction_ids = deconvoluted_df[deconvoluted_df['gene_name'].isin(genes)]['id_cp_interaction'].tolist()
            interacting_pairs_from_genes = [result_dict['interaction_id2interacting_pair'][i] for i in interaction_ids]
            if not interacting_pairs:
                interacting_pairs = []
            interacting_pairs += interacting_pairs_from_genes

        # Sort selected interacting_pairs by expression
        # ... by first pre-selecting all interacting pairs, sorted by expression
        all_interacting_pairs_sorted_by_expression = preselect_interacting_pairs(result_dict, selected_cell_type_pairs, "all")
        # ... and then plucking out all interacting_pairs from that list (so that the order by expression is preserved)
        interacting_pairs = [ip for ip in all_interacting_pairs_sorted_by_expression if ip in interacting_pairs]

    if sort_interacting_pairs_alphabetically:
        # Sort selected interacting_pairs alphabetically
        interacting_pairs.sort(key=str.lower)

    result_dict['selected_genes'] = sorted(list(set(genes)))
    result_dict['selected_interacting_pairs'] = interacting_pairs
    result_dict['selected_cell_type_pairs'] = selected_cell_type_pairs
    if interacting_pairs:
        if 'interacting_pair2classes' in result_dict:
            selected_interacting_pair2class = {}
            for ip in interacting_pairs:
                if ip in result_dict['interacting_pair2classes']:
                    classes = result_dict['interacting_pair2classes'][ip]
                    if "," in classes:
                        # TODO: Confirm if multiple classes will be stored in comma-separated list
                        classes = "multiple"
                else:
                    classes = "none"
                selected_interacting_pair2class[ip] = classes
            result_dict['selected_interacting_pair2class'] = selected_interacting_pair2class
        interactions.update( \
            means_df[means_df['interacting_pair'].isin(interacting_pairs)]['id_cp_interaction'].tolist())
    if interactions:
        result_means_df = means_df[means_df['id_cp_interaction'].isin(interactions)]
        # Filter out cell_type_pairs/columns in cols_filter for which no interaction in interactions set is significant
        # TODO: means_cols_filter = means_cols_filter[result_means_df[means_cols_filter].notna().any(axis=0)]
        # Filter out interactions which are not significant in any cell_type_pair/column in cols_filter
        # TODO: result_means_df = result_means_df[result_means_df[means_cols_filter].notna().any(axis=1)]
        # Sort rows by the order of interacting_pairs
        result_means_df.set_index('interacting_pair', inplace=True)
        # N.B. reversed() call below means that the first element of interacting_pairs is shown at the top of cci_search plot
        result_means_df = result_means_df.reindex(reversed(interacting_pairs))
        result_means_df.reset_index(drop=False, inplace=True)
        result_dict['interacting_pairs_means'] = result_means_df['interacting_pair'].values.tolist()
        result_means_df = result_means_df[means_cols_filter.tolist()]
        # Sort columns according to the order in selected_cell_type_pairs (see sort_cell_type_pairs() call above)
        result_means_df = result_means_df.reindex(selected_cell_type_pairs, axis=1)
        result_dict['cell_type_pairs_means'] = result_means_df.columns.tolist()
        # Replace nan with 0's in result_means_df.values
        means_np_arr = np.nan_to_num(result_means_df.values, copy=False, nan=0.0)
        # Calculate z-scores
        zscores_df = stats.zscore(result_means_df, axis=1)
        zscores_arr = np.nan_to_num(zscores_df.values, copy=False, nan=0.0)
        zscores_arr = np.round(zscores_arr, 3)
        if values_to_show == 'scores':
            if 'interaction_scores' in result_dict:
                filtered_interaction_scores_arr = means_np_arr.copy().tolist()
                for i, row in enumerate(filtered_interaction_scores_arr):
                    for j, _ in enumerate(row):
                        cell_type = selected_cell_type_pairs[j]
                        interacting_pair = result_dict['interacting_pairs_means'][i]
                        if cell_type in result_dict['interaction_scores'] and interacting_pair in \
                                result_dict['interaction_scores'][cell_type]:
                            filtered_interaction_scores_arr[i][j] = \
                            result_dict['interaction_scores'][cell_type][interacting_pair]
                        else:
                            # interaction_scores = 0.0 have been filtered out to reduce API output
                            filtered_interaction_scores_arr[i][j] = 0
            result_dict['values'] = filtered_interaction_scores_arr
            result_dict['min_value'] = 0
            result_dict['max_value'] = 100
        elif values_to_show == 'zscores':
            result_dict['values'] = zscores_arr.tolist()
            if zscores_arr.size > 0:
                # Some significant interactions were found
                result_dict['min_value'] = zscores_arr.min(axis=None)
                result_dict['max_value'] = zscores_arr.max(axis=None)
        else:
            # show means (by default)
            result_dict['values'] = means_np_arr.tolist()
            if means_np_arr.size > 0:
                # Some significant interactions were found
                result_dict['min_value'] = means_np_arr.min(axis=None)
                result_dict['max_value'] = means_np_arr.max(axis=None)

        if 'relevant_interactions' in result_dict:
            result_dict['filtered_relevant_interactions'] = means_np_arr.copy().tolist()
            for i, row in enumerate(result_dict['filtered_relevant_interactions']):
                for j, _ in enumerate(row):
                    cell_type = selected_cell_type_pairs[j]
                    interacting_pair = result_dict['interacting_pairs_means'][i]
                    if cell_type in result_dict['relevant_interactions'] and interacting_pair in result_dict['relevant_interactions'][cell_type]:
                        result_dict['filtered_relevant_interactions'][i][j] = result_dict['relevant_interactions'][cell_type][interacting_pair]
                    else:
                        # relevant interactions values = 0 have been filtered out to reduce API output
                        result_dict['filtered_relevant_interactions'][i][j] = 0

        if 'pvalues' in result_dict:
            result_dict['filtered_pvalues'] = means_np_arr.copy().tolist()
            for i, row in enumerate(result_dict['filtered_pvalues']):
                for j, _ in enumerate(row):
                    cell_type = selected_cell_type_pairs[j]
                    interacting_pair = result_dict['interacting_pairs_means'][i]
                    if cell_type in result_dict['pvalues'] and interacting_pair in result_dict['pvalues'][cell_type]:
                        result_dict['filtered_pvalues'][i][j] = result_dict['pvalues'][cell_type][interacting_pair]
                    else:
                        # pvalues = 1.0 have been filtered out to reduce API output
                        result_dict['filtered_pvalues'][i][j] = 1
        if 'cellphonedb' in result_dict:
            result_dict['interacting_pair2properties_html'] = get_properties_html_for_interacting_pairs(result_dict)

def filter_interactions_for_cci_summary(result_dict, file_name2df, classes, min_score):
    means_df = file_name2df['analysis_means']
    separator = result_dict['separator']

    # Filter means_df by interacting pairs belonging to a class in classes
    if classes:
        interacting_pairs = []
        for c in classes:
            interacting_pairs.extend(result_dict['class2interacting_pairs'][c])
        means_df = copy.deepcopy(means_df[means_df['interacting_pair'].isin(interacting_pairs)])
    size = len(result_dict['all_cell_types'])
    ct2indx = result_dict['ct2indx']
    ct_sortedbyme2indx = result_dict['ct_sortedbyme2indx']
    all_cell_types_combinations = get_cell_type_pairs(means_df, separator)
    num_ints = np.zeros((size, size),dtype=np.uint32)
    num_ints_cts_sortedbyme = np.zeros((size, size), dtype=np.uint32)
    for ct_pair in all_cell_types_combinations:
         if min_score == 0 or 'interaction_scores' not in result_dict:
            s = means_df[ct_pair].dropna()
            num_ints4ctp = len(s[s>0])
         else:
            interaction_scores = result_dict['interaction_scores']
            s = interaction_scores[ct_pair].values()
            num_ints4ctp = len([i for i in s if i >= min_score])
         ct1 = ct_pair.split(separator)[0]
         ct2 = ct_pair.split(separator)[1]
         num_ints[ct2indx[ct1], ct2indx[ct2]] = num_ints4ctp
         num_ints_cts_sortedbyme[ct_sortedbyme2indx[ct1], ct_sortedbyme2indx[ct2]] = num_ints4ctp
    result_dict['num_ints'] = num_ints.tolist()
    # The matrix below is used to plot 'all celltypes' cci_summary plots - if microenvironments were provided in config
    # result_dict['num_ints_cts_sortedbyme'] reflects cell types grouped by microenvironment, whereas
    # result_dict['num_ints'] reflects microenvironments sorted alphabetically.
    result_dict['num_ints_cts_sortedbyme'] = num_ints_cts_sortedbyme.tolist()
    result_dict['min_num_ints'] = str(np.min(num_ints))
    result_dict['max_num_ints'] = str(np.max(num_ints))

def generate_random_hash():
    # See: https://docs.python.org/3/library/secrets.html (16 = bytes ~ 16 * 1.3 chars)
    return secrets.token_urlsafe(16)
