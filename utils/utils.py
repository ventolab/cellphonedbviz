import os
import pandas as pd
import numpy as np
from scipy import stats
import yaml
import random
import re
from collections import OrderedDict

base_path = os.path.dirname(os.path.realpath(__file__))
DATA_ROOT = f"{base_path}/../data"
# Note that 'deconvoluted_result' has to come after 'significant_means' in CONFIG_KEYS. This is because of pre-filtering of interacting pairs
# on first page load - from deconvoluted file we need to pre-select genes but we don't have interacting_pair information in that file, hence
# we need to get the mapping: interacting pair->interaction_id from the means file and only then we can do interaction_id->genes in deconvoluted file.
CONFIG_KEYS = ['title','cell_type_data','lineage_data','celltype_composition','microenvironments', \
               'significant_means', 'relevant_interactions', 'deconvoluted_result','deconvoluted_percents','degs','pvalues']
VIZZES = ['celltype_composition','microenvironments','single_gene_expression', \
          'cell_cell_interaction_summary','cell_cell_interaction_search']
MAX_NUM_STACKS_IN_CELLTYPE_COMPOSITION= 6
SANKEY_EDGE_WEIGHT = 30
NUMBER_OF_INTERACTING_PAIRS_TO_PRESELECT_ON_FIRST_LOAD = 15
NUMBER_OF_CELL_TYPE_PAIRS_TO_PRESELECT_ON_FIRST_LOAD = 15

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
                with open('{}/config.yml'.format(root), 'r') as file:
                    config = yaml.safe_load(file)
                    dict['title'] = config['title']
                    for key in CONFIG_KEYS[3:]:
                        if key in config:
                            fpath = "{}/{}".format(root, config[key])
                            df = pd.read_csv(fpath, sep='\t')
                            populate_data4viz(key, dict, df, config['separator'], dir_name2file_name2df[dir_name])
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
    elif config_key == 'significant_means':
        populate_significant_means_data(result_dict, df, separator)
    elif config_key == 'deconvoluted_result':
        populate_deconvoluted_data(result_dict, df, separator, percents=False)
    elif config_key == 'deconvoluted_percents':
        populate_deconvoluted_data(result_dict, df, separator, percents=True)
    elif config_key == 'degs':
        populate_degs_data(result_dict, df)
    elif config_key == 'pvalues':
        populate_pvalues_data(result_dict, df)
    elif config_key == 'relevant_interactions':
        populate_relevant_interactions_data(result_dict, df)
    if config_key in ['deconvoluted_result', 'significant_means','deconvoluted_percents']:
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
        dict_sge['microenvironment2cell_types'] = {}
        dict_cci_search['cell_type2microenvironments'] = {}
        for i, j in zip(df[me_col_name].values.tolist(), df[ct_col_name].values.tolist()):
            dict_sge['microenvironment2cell_types'].setdefault(i, []).append(j)
        for i, j in zip(df[ct_col_name].values.tolist(), df[me_col_name].values.tolist()):
            dict_cci_search['cell_type2microenvironments'].setdefault(i, []).append(j)
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
            y_box = int(400 / len(items))
        else:
            y_space, y_box = 0, 0
        dict_cc['y_space{}'.format(idx)] = y_space
        dict_cc['y_box{}'.format(idx)] = y_box

def populate_significant_means_data(dict_dd, df, separator):
    dict_cci_summary = dict_dd['cell_cell_interaction_summary']
    dict_cci_search = dict_dd['cell_cell_interaction_search']
    cell_type_pair_columns = df.columns[12:]
    all_cell_types_combinations = list(cell_type_pair_columns)
    all_cell_types = set([])
    for ct_pair in all_cell_types_combinations:
        all_cell_types.update(ct_pair.split(separator))
    all_cell_types = sorted(list(all_cell_types))
    ct2indx = dict([(ct, all_cell_types.index(ct)) for ct in all_cell_types])
    size = len(all_cell_types)
    num_ints = np.zeros((size, size),dtype=np.uint32)
    for ct_pair in all_cell_types_combinations:
        ct1 = ct_pair.split(separator)[0]
        ct2 = ct_pair.split(separator)[1]
        s = df[ct_pair].dropna()
        # NB. s>0 test below is in case means file from basic analysis is provided in config for significant_means key
        num_ints[ct2indx[ct1], ct2indx[ct2]] = len(s[s>0])
    dict_cci_summary['all_cell_types'] = all_cell_types
    dict_cci_summary['num_ints'] = num_ints.tolist()
    dict_cci_summary['min_num_ints'] = str(np.min(num_ints))
    dict_cci_summary['max_num_ints'] = str(np.max(num_ints))
    dict_cci_summary['ct2indx'] = ct2indx
    # Data below is needed for autocomplete functionality
    dict_cci_search['all_cell_type_pairs'] = sorted(all_cell_types_combinations)
    df_ips = df[df.columns.intersection(['interacting_pair'] + all_cell_types_combinations)].copy()
    df_ips.set_index('interacting_pair', inplace=True)
    # Assign to 'all_interacting_pairs' key the list of interacting pairs sorted by the highest aggregated
    # across all cell type pairs means
    dict_cci_search['all_interacting_pairs'] = df_ips.sum(axis=1).sort_values(ascending=False).index.tolist()
    # On first page load, we pre-select N interacting pairs (from means file), but we can map each interacting
    # pair label to a pair of gene names using deconvoluted file (via interaction id - shared by deconvoluted and means files - hence the dict below
    dict_cci_search['interaction_id2interacting_pair'] = {}
    for i, j in zip(df['id_cp_interaction'].values.tolist(), df['interacting_pair'].values.tolist()):
        dict_cci_search['interaction_id2interacting_pair'][i] = j

def preselect_interacting_pairs(dict_cci_search: dict):
    # This logic will change once we have output interactions scores from CellphoneDB -
    # then we will pre-select top (=with the highest score) N interactions
    return dict_cci_search['all_interacting_pairs'][0:NUMBER_OF_INTERACTING_PAIRS_TO_PRESELECT_ON_FIRST_LOAD]

def preselect_cell_type_pairs(dict_cci_search: dict):
    # TESTING:
    # random.seed(10)
    # TESTING:
    return random.sample(list(dict_cci_search['all_cell_type_pairs']), NUMBER_OF_CELL_TYPE_PAIRS_TO_PRESELECT_ON_FIRST_LOAD)
    # return dict_cci_search['all_cell_type_pairs'][0:NUMBER_OF_CELL_TYPE_PAIRS_TO_PRESELECT_ON_FIRST_LOAD]

def populate_deconvoluted_data(dict_dd, df, separator = None, selected_genes = None, selected_cell_types = None, refresh_plot = False, percents = False):
    dict_sge = dict_dd['single_gene_expression']
    dict_cci_search = dict_dd['cell_cell_interaction_search']
    if not separator:
        separator = dict_dd['cell_cell_interaction_search']['separator']

    # On first page load, we pre-select N interacting pairs (from means file), but we can map each interacting
    # pair label to a pair of gene names using deconvoluted file (via interaction id - shared by deconvoluted and means files -
    # hence the need for interacting_pair2genes_names
    interacting_pair2genes_names = {}
    for i, j in zip(df['id_cp_interaction'].values.tolist(), df['gene_name'].values.tolist()):
        if i in dict_cci_search['interaction_id2interacting_pair']:
            interacting_pair = dict_cci_search['interaction_id2interacting_pair'][i]
            interacting_pair2genes_names.setdefault(interacting_pair, set([])).add(j)

    if not selected_genes:
        if not refresh_plot:
            # Pre-select interacting_pairs
            selected_interacting_pairs = preselect_interacting_pairs(dict_cci_search)
            selected_genes = set([])
            # Derive pre-selected genes from the pre-selected interacting_pairs
            for ip in selected_interacting_pairs:
                selected_genes.update(interacting_pair2genes_names[ip])
            selected_genes = sorted(list(selected_genes))
        else:
            selected_genes = []
    dict_sge['genes'] = selected_genes

    if not selected_cell_types:
        if not refresh_plot:
            # Pre-select cell type pairs
            selected_cell_type_pairs = preselect_cell_type_pairs(dict_cci_search)
            # Derive pre-selected cell types from selected_cell_type_pairs
            selected_cell_types = set([])
            for ctp in selected_cell_type_pairs:
                selected_cell_types.update(set(ctp.split(separator)))
            selected_cell_types = list(selected_cell_types)
        else:
            selected_cell_types = []
    selected_cell_types = sorted(list(set(selected_cell_types)))
    dict_sge['cell_types'] = selected_cell_types

    # Note: all_genes is needed for autocomplete - for the user to include genes in the plot
    all_genes = set(df['gene_name'].values)
    all_cell_types = list(df.columns[6:])

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
    # Data below is needed for autocomplete functionality
    dict_sge['all_genes'] = all_genes
    dict_sge['all_cell_types'] = all_cell_types
    dict_cci_search['all_genes'] = all_genes
    dict_cci_search['all_cell_types'] = all_cell_types

def populate_pvalues_data(result_dict, df):
    dict_cci_search = result_dict['cell_cell_interaction_search']
    dict_pvals = {}
    all_cell_types_combinations = list(df.columns[12:])
    for ct_pair in all_cell_types_combinations:
        # Filter out pvals = 1.0 - no point bloating the API call result
        df_filtered = df[df[ct_pair] < 1]
        dict_pvals[ct_pair] = dict(zip(df_filtered['interacting_pair'], df_filtered[ct_pair]))
    dict_cci_search['pvalues'] = dict_pvals


def populate_relevant_interactions_data(result_dict, df):
    dict_cci_search = result_dict['cell_cell_interaction_search']
    dict_pvals = {}
    all_cell_types_combinations = list(df.columns[12:])
    for ct_pair in all_cell_types_combinations:
        # Filter out values of 0 (= irrelevant interactions) - no point bloating the API call result
        df_filtered = df[df[ct_pair] > 0]
        dict_pvals[ct_pair] = dict(zip(df_filtered['interacting_pair'], df_filtered[ct_pair]))
    dict_cci_search['relevant_interactions'] = dict_pvals

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

def sort_cell_type_pairs(cell_type_pairs, result_dict, separator) -> (list, dict):
    if 'cell_type2microenvironments' not in result_dict:
        selected_cell_type_pairs = sorted(cell_type_pairs)
        ctp2me = {ctp: 'all' for ctp in selected_cell_type_pairs}
        return selected_cell_type_pairs, ctp2me
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
            if len(mes1) == 1 and len(mes2) == 1 and mes1[0] == mes2[0]:
                me = mes1[0]
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

def filter_interactions(result_dict,
                        file_name2df,
                        genes,
                        interacting_pairs,
                        cell_types,
                        cell_type_pairs,
                        refresh_plot,
                        show_zscores):
    means_df = file_name2df['significant_means']
    deconvoluted_df = file_name2df['deconvoluted_result']
    separator = result_dict['separator']

    # Collect all combinations of cell types (disregarding the order) from cell_types and cell_type_pairs combined
    if cell_types:
        selected_cell_types = cell_types
        # Derive selected_cell_type_pairs from selected_cell_types
        selected_cell_type_pairs = []
        if cell_type_pairs:
            # Note: the search for cell types and cell type pairs is additive (inclusive OR)
            selected_cell_type_pairs += cell_type_pairs
        for ct in selected_cell_types:
            for ct1 in selected_cell_types:
                selected_cell_type_pairs += ["{}{}{}".format(ct, separator, ct1), "{}{}{}".format(ct1, separator, ct)]
        # Restrict all combinations of cell types to just those in means_df
        selected_cell_type_pairs = [ct_pair for ct_pair in selected_cell_type_pairs if ct_pair in means_df.columns.values]
    elif not cell_type_pairs:
        selected_cell_types = []
        if not refresh_plot:
            # Pre-select cell type pairs
            selected_cell_type_pairs = preselect_cell_type_pairs(result_dict)
        else:
            selected_cell_type_pairs = []
    else:
        selected_cell_types = []
        selected_cell_type_pairs = cell_type_pairs
    means_cols_filter = means_df.columns[means_df.columns.isin(selected_cell_type_pairs)]
    result_dict['selected_cell_types'] = sorted(selected_cell_types)
    selected_cell_type_pairs, ctp2me = \
        sort_cell_type_pairs(selected_cell_type_pairs, result_dict, separator)
    result_dict['selected_cell_type_pairs'] = selected_cell_type_pairs
    # The following will be used to colour cell type pair labels on the plot's x-axis depending on
    # micro-environment they _both_ belong to.
    result_dict['selected_cell_type_pairs2microenvironment'] = ctp2me
    # Collect all interactions from query_genes and query_interactions
    interactions = set([])
    if not genes and not interacting_pairs:
        if not refresh_plot:
            # If neither genes nor interactions are selected, pre-select interacting pairs
            interacting_pairs = preselect_interacting_pairs(result_dict)
        else:
            genes = []
            interacting_pairs = []
    if genes:
            interactions.update( \
                deconvoluted_df[deconvoluted_df['gene_name'].isin(genes)]['id_cp_interaction'].tolist())
    result_dict['selected_genes'] = sorted(list(set(genes)))
    result_dict['selected_interacting_pairs'] = interacting_pairs
    if interacting_pairs:
        interactions.update( \
            means_df[means_df['interacting_pair'].isin(interacting_pairs)]['id_cp_interaction'].tolist())
    if interactions:
        result_means_df = means_df[means_df['id_cp_interaction'].isin(interactions)]
        # Filter out cell_type_pairs/columns in cols_filter for which no interaction in interactions set is significant
        # TODO: means_cols_filter = means_cols_filter[result_means_df[means_cols_filter].notna().any(axis=0)]
        # Filter out interactions which are not significant in any cell_type_pair/column in cols_filter
        # TODO: result_means_df = result_means_df[result_means_df[means_cols_filter].notna().any(axis=1)]
        # Sort rows by interacting_pair
        result_means_df = result_means_df.sort_values(by=['interacting_pair'])
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
        if show_zscores:
            result_dict['values'] = zscores_arr.tolist()
            if zscores_arr.size > 0:
                # Some significant interactions were found
                result_dict['min_value'] = zscores_arr.min(axis=None)
                result_dict['max_value'] = zscores_arr.max(axis=None)
        else:
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

