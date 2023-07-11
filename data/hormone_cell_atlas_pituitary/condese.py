#!/Users/rp23/miniconda3/envs/cpdbviz/bin/python
import sys 

fname = sys.argv[1]

import numpy as np
colnums=set([])
rownums=set([])
with open('./statistical_analysis_pvalues_06_28_2023_210049.txt_Pituitary.txt', 'r') as f:
    f.readline() # skip the header
    for i, line in enumerate(f.read().split('\n')):
        x = line.split('\t')[12:]
        x = np.array(x)
        pvals = x.astype(float).tolist()
        for j, pval in enumerate(pvals):
            if pval <= 0.05:
                colnums.add(j + 12)
                rownums.add(i + 1)
        # print(".",end="", flush=True)
    # print(len(rownums))
    # print(len(colnums))

    with open(fname, 'r') as f:
        for i, line in enumerate(f.read().split('\n')):
            if i == 0 or i in rownums:
                arr = line.split('\t')
                row = arr[1:12]
                for j in sorted(list(colnums)):
                    row.append(arr[j])
                print('\t'.join(row))
