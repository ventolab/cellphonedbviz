import os
import math
import pandas as pd
import numpy as np
import yaml
import random
import re

base_path = os.path.dirname(os.path.realpath(__file__))
DATA_ROOT = f"{base_path}/../data"
CONFIG_KEYS = ['title','cell_type_data','microenvironments_data','celltype_composition','deconvoluted_result','significant_means','degs','pvalues']
VIZZES = ['celltype_composition','single_gene_expression','cell_cell_interaction_summary','cell_cell_interaction_search']
MAX_NUM_STACKS_IN_CELLTYPE_COMPOSITION= 6
SANKEY_EDGE_WEIGHT = 30

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
                    dict['cell_type_col_name'] = config['cell_type_data']
                    dict['microenvironments_col_name'] = config['microenvironments_data']
                    for key in CONFIG_KEYS[3:]:
                        fpath = "{}/{}".format(root, config[key])
                        df = pd.read_csv(fpath, sep='\t')
                        populate_data4viz(key, dict, df, config['separator'], dir_name2file_name2df[dir_name])
                    dict['cell_cell_interaction_search']['separator'] = config['separator']
                    filter_interactions(dict['cell_cell_interaction_search'], dir_name2file_name2df[dir_name])
                    dir_name2project_data[dir_name] = dict
    return (dir_name2project_data, dir_name2file_name2df)

def populate_data4viz(config_key, result_dict, df, separator, file_name2df):
    for viz in VIZZES:
        if viz not in result_dict:
            result_dict[viz] = {}
    if config_key == 'celltype_composition':
        populate_celltype_composition_data(result_dict, df)
    elif config_key == 'deconvoluted_result':
        populate_deconvoluted_data(result_dict, df)
    elif config_key == 'significant_means':
        populate_significant_means_data_for_cci(result_dict, df, separator)
    elif config_key == 'degs':
        populate_degs_data(result_dict, df)
    elif config_key == 'pvalues':
        populate_pvalues_data(result_dict, df)
    if config_key in ['deconvoluted_result', 'significant_means']:
        file_name2df[config_key] = df

def populate_celltype_composition_data(result_dict, df):
    dict_cc = result_dict['celltype_composition']
    dict_sge = result_dict['single_gene_expression']
    dict_cci_summary = result_dict['cell_cell_interaction_summary']
    dict_cci_search = result_dict['cell_cell_interaction_search']
    dict_cc['title'] = ' - '.join(df.columns.values)
    edges = set([])
    dict_cc['raw_data'] = df.values.tolist()
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
    dict_cc['edges'] = [list(x) for x in edges]
    dict_cc['all_elems'] = list(sorted(all_elems))
    for idx, items in enumerate(stacks):
        dict_cc['list{}'.format(idx)] = sorted(list(items))
        if items:
            y_space = int(300 / len(items))
            y_box = int(150 / len(items))
        else:
            y_space, y_box = 0, 0
        dict_cc['y_space{}'.format(idx)] = y_space
        dict_cc['y_box{}'.format(idx)] = y_box
        # Data for Spatial micro-environments plot
        dict_cc['y_vals'] = sorted(list(set(df['Cell type'].values)))
        dict_cc['x_vals'] = sorted(list(set(df['Lineage'].values)))
        dict_cc['color_domain'] = sorted(list(set(df['Menstrual stage'].values)))
    # Data for filtering of cell types by micro-environment in single gene expression plot
    cell_type_col_name = result_dict['cell_type_col_name']
    microenvironments_col_name = result_dict['microenvironments_col_name']
    dict_sge['microenvironments'] = sorted(list(set(df[microenvironments_col_name].values)))
    dict_cci_search['microenvironments'] = dict_sge['microenvironments']
    dict_sge['microenvironment2cell_types'] = {}
    for i, j in zip(df[microenvironments_col_name].values.tolist(), df[cell_type_col_name].values.tolist()):
        dict_sge['microenvironment2cell_types'].setdefault(i, []).append(j)
    dict_cci_summary['microenvironment2cell_types'] = dict_sge['microenvironment2cell_types']
    dict_cci_search['microenvironment2cell_types'] = dict_sge['microenvironment2cell_types']

def populate_significant_means_data_for_cci(dict_dd, df, separator):
    dict_cci_summary = dict_dd['cell_cell_interaction_summary']
    dict_cci_search = dict_dd['cell_cell_interaction_search']
    all_cell_types_combinations = list(df.columns[12:])
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
    dict_cci_search['all_interacting_pairs'] = sorted(list(df['interacting_pair'].values))

def populate_deconvoluted_data(dict_dd, df, selected_genes = None, selected_cell_types = None):
    dict_sge = dict_dd['single_gene_expression']
    dict_cci_search = dict_dd['cell_cell_interaction_search']
    # Note: all_genes is needed for autocomplete - for the user to include genes in the plot
    all_genes = set(df['gene_name'].values)
    gene2complexes = {}
    for i, j in zip(df['gene_name'], df['complex_name']):
        gene2complexes.setdefault(i, set([])).add(j)
    all_cell_types = list(df.columns[6:])
    # TODO - decide how the initial genes_sample is selected
    # DEBUG print(selected_genes)
    if not selected_genes:
        selected_genes = random.sample(list(all_genes), 10)
    selected_genes = sorted(list(set(selected_genes)))
    # DEBUG print(selected_cell_types)
    if not selected_cell_types:
        selected_cell_types = all_cell_types
    selected_cell_types = sorted(list(set(selected_cell_types)))
    dict_sge['cell_types'] = selected_cell_types
    # Retrieve means for genes in selected_genes and cell types in all_cell_types
    selected_genes_means_df = df[df['gene_name'].isin(selected_genes)][['gene_name', 'complex_name'] + selected_cell_types].drop_duplicates()
    gene_complex_list = (selected_genes_means_df['gene_name'] + " in " + selected_genes_means_df['complex_name'].fillna('')).values
    gene_complex_list = [re.sub(r"\sin\s$", "", x) for x in gene_complex_list]
    mean_expressions = selected_genes_means_df[selected_cell_types]

    dict_sge['gene_complex'] = gene_complex_list
    dict_sge['mean_expressions'] = mean_expressions.values.tolist()
    dict_sge['min_expression'] = mean_expressions.min(axis=None)
    dict_sge['max_expression'] = mean_expressions.max(axis=None)
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
        df_filtered = df[df[ct_pair].apply(pval4plot) > 0]
        dict_pvals[ct_pair] = dict(zip(df_filtered['interacting_pair'], df_filtered[ct_pair].apply(pval4plot)))
    dict_cci_search['pvalues'] = dict_pvals

def pval4plot(pvalue) -> int:
    if pvalue > 0:
        val = min(round(abs(math.log10(pvalue))),3)
    else:
        val = 3
    return val

def populate_degs_data(result_dict, df):
    dict_degs = result_dict['single_gene_expression']
    deg2cell_type = dict(zip(df['gene'], df['cluster']))
    cell_type2degs = {}
    for (deg, cell_type) in deg2cell_type.items():
        if cell_type not in cell_type2degs:
            cell_type2degs[cell_type] = set([])
        cell_type2degs[cell_type].add(deg)
    # Convert sets to lists
    for (cell_type, degs) in cell_type2degs.items():
        cell_type2degs[cell_type] = list(degs)
    dict_degs['celltype2degs'] = cell_type2degs

def filter_interactions(result_dict,
                        file_name2df,
                        genes = None,
                        interacting_pairs = None,
                        cell_types = None,
                        cell_type_pairs = None,
                        microenvironments = None):
    means_df = file_name2df['significant_means']
    deconvoluted_df = file_name2df['deconvoluted_result']
    separator = result_dict['separator']

    # Collect all combinations of cell types (disregarding the order) from cell_types and cell_type_pairs combined

    # Populate selected_cell_types
    if microenvironments:
        # Some cell types can be in multiple microenvironments
        selected_cell_types = set([])
        for me in microenvironments:
            selected_cell_types = selected_cell_types.update(result_dict['microenvironment2cell_types'][me])
        selected_cell_types = list(selected_cell_types)
    elif cell_types:
        selected_cell_types = cell_types
    elif not cell_type_pairs:
        # TODO - decide how the initial cell types sample is selected
        selected_cell_types = random.sample(list(result_dict['all_cell_types']), 5)
    else:
        selected_cell_types = []
    result_dict['selected_cell_types'] = sorted(selected_cell_types)

    # Populate selected_cell_type_pairs
    selected_cell_type_pairs = []
    if cell_type_pairs:
        selected_cell_type_pairs += cell_type_pairs
    for ct in selected_cell_types:
        for ct1 in selected_cell_types:
            selected_cell_type_pairs += ["{}{}{}".format(ct, separator, ct1), "{}{}{}".format(ct1, separator, ct)]
    means_cols_filter = means_df.columns[means_df.columns.isin(selected_cell_type_pairs)]

    # Collect all interactions from query_genes and query_interactions
    interactions = set([])
    if not genes and not interacting_pairs:
        # If neither genes nor interactions are selected, choose N random genes
        # TODO - decide how the initial genes sample is selected
        genes = random.sample(list(result_dict['all_genes']), 5)
    if genes:
            interactions.update( \
                deconvoluted_df[deconvoluted_df['gene_name'].isin(genes)]['id_cp_interaction'].tolist())
            result_dict['selected_genes'] = sorted(list(set(genes)))
    if interacting_pairs:
        interactions.update( \
            means_df[means_df['interacting_pair'].isin(interacting_pairs)]['id_cp_interaction'].tolist())
    if interactions:
        result_means_df = means_df[means_df['id_cp_interaction'].isin(interactions)]
    else:
        result_means_df = means_df

    # Filter out cell_type_pairs/columns in cols_filter for which no interaction in interactions set is significant
    means_cols_filter = means_cols_filter[result_means_df[means_cols_filter].notna().any(axis=0)]
    # Filter out interactions which are not significant in any cell_type_pair/column in cols_filter
    result_means_df = result_means_df[result_means_df[means_cols_filter].notna().any(axis=1)]
    # Sort rows by interacting_pair
    result_means_df = result_means_df.sort_values(by=['interacting_pair'])
    result_dict['interacting_pairs_means'] = result_means_df['interacting_pair'].values.tolist()
    result_means_df = result_means_df[means_cols_filter.tolist()]
    # Sort columns alphabetically
    result_means_df = result_means_df.reindex(sorted(result_means_df.columns), axis=1)
    result_dict['cell_type_pairs_means'] = result_means_df.columns.tolist()
    # Replace nan with 0's in result_means_df.values
    means_np_arr = np.nan_to_num(result_means_df.values, copy=False, nan=0.0)
    result_dict['means'] = means_np_arr.tolist()
    if len(means_np_arr) > 0:
        # Some significant interactions were found
        result_dict['min_expression'] = means_np_arr.min(axis=None)
        result_dict['max_expression'] = means_np_arr.max(axis=None)
    result_dict['filtered_pvalues'] = means_np_arr.copy().tolist()
    for i, row in enumerate(result_dict['filtered_pvalues']):
        for j, _ in enumerate(row):
            cell_type = selected_cell_type_pairs[j]
            interacting_pair = result_dict['interacting_pairs_means'][i]
            if cell_type in result_dict['pvalues'] and interacting_pair in result_dict['pvalues'][cell_type]:
                result_dict['filtered_pvalues'][i][j] = result_dict['pvalues'][cell_type][interacting_pair]
            else:
                # pvalues = 1.0 have been filtered out to reduce API output
                result_dict['filtered_pvalues'][i][j] = 0

