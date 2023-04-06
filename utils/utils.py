import os
import pandas as pd
import yaml
import random
import re

base_path = os.path.dirname(os.path.realpath(__file__))
DATA_ROOT = f"{base_path}/../data"
CONFIG_KEYS = ['title','celltype_composition','deconvoluted_result','degs']
VIZZES = ['celltype_composition','single_gene_expression']
MAX_NUM_STACKS_IN_CELLTYPE_COMPOSITION= 6
SANKEY_EDGE_WEIGHT = 30

def get_projects() -> dict:
    dir_name2project_data={}
    project_dirs = None
    for root, dirs, files in os.walk(DATA_ROOT):
        if not project_dirs:
            project_dirs = dirs
        else:
            dir_name = root.split("/")[-1]
            if dir_name in project_dirs:
                dict = {}
                with open('{}/config.yml'.format(root), 'r') as file:
                    config = yaml.safe_load(file)
                    dict['title'] = config['title']
                    for key in CONFIG_KEYS[1:]:
                        fpath = "{}/{}".format(root, config[key])
                        df = pd.read_csv(fpath, sep='\t')
                        populate_data4viz(key, dict, df)
                    dir_name2project_data[dir_name] = dict
    return dir_name2project_data

def populate_data4viz(config_key, result_dict, df):
    for viz in VIZZES:
        if viz not in result_dict:
            result_dict[viz] = {}
    if config_key == 'celltype_composition':
        populate_celltype_composition_data(result_dict, df)
    elif config_key == 'deconvoluted_result':
        populate_deconvoluted_data(result_dict, df)
    elif config_key == 'degs':
        populate_degs_data(result_dict, df)

def populate_celltype_composition_data(result_dict, df):
    dict_cc = result_dict['celltype_composition']
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

def populate_deconvoluted_data(result_dict, df):
    dict_dd = result_dict['single_gene_expression']
    # TODO: Will need all_genes for autocomplete - for the user to include genes in the plot
    all_genes = set(df['gene_name'].values)
    gene2complexes = {}
    for i, j in zip(df['gene_name'], df['complex_name']):
        gene2complexes.setdefault(i, set([])).add(j)
    all_cell_types = list(df.columns[6:])
    # TODO - decide how the initial genes_sample is selected
    genes_sample = random.sample(list(all_genes), 10)
    # Retrieve means for genes in genes_sample and cell types in all_cell_types
    sample_genes_means_df = df[df['gene_name'].isin(genes_sample)][['gene_name', 'complex_name'] + all_cell_types].drop_duplicates()
    gene_complex_list = (sample_genes_means_df['gene_name'] + " in " + sample_genes_means_df['complex_name'].fillna('')).values
    gene_complex_list = [re.sub(r"\sin\s$", "", x) for x in gene_complex_list]
    mean_expressions = sample_genes_means_df[all_cell_types]
    dict_dd['all_cell_types'] = all_cell_types
    dict_dd['gene_complex'] = gene_complex_list
    dict_dd['mean_expressions'] = mean_expressions.values.tolist()
    dict_dd['min_expression'] = mean_expressions.min(axis=None)
    dict_dd['max_expression'] = mean_expressions.max(axis=None)

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