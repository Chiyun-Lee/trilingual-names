import numpy as np
import pandas as pd
import streamlit as st

st.set_page_config(page_title="Triolingo Character Lookup", layout="wide")

@st.cache_data
def load_data():
    return pd.read_pickle("triolingo.pkl.xz")

def inequality_score(lst):
    n = len(lst)
    sorted_lst = sorted(lst)
    cumulative = sum((2 * (i + 1) - n - 1) * val for i, val in enumerate(sorted_lst))
    gini = cumulative / (n * sum(lst)) if sum(lst) > 0 else 0
    scaled_capped_sum = min(5, sum(lst)) / 5
    return gini * scaled_capped_sum

def max_proportion(lst):
    counts = np.array(lst)
    return counts.max() / counts.sum() if counts.sum() > 0 else 0

def sum_squared_proportion(lst):
    counts = np.array(lst)
    proportions = counts / counts.sum() if counts.sum() > 0 else np.zeros_like(counts)
    return np.sum(proportions ** 2)

df = load_data()

st.title("Triolingo Character Lookup")
language_labels = {
    "katakana_romaji": "Japanese (Romaji)",
    "kHangul": "Korean (Hangul)",
    "toneless_pinyin": "Chinese (tone-less Pinyin)",
    "kMandarin": "Chinese (Pinyin)"
}
label_to_lang = {v: k for k, v in language_labels.items()}

metric_labels = {
    "inequality_score": "Inequality Score",
    "max_proportion": "Max Proportion",
    "sum_squared_proportion": "Sum of Squared Proportions"
}
label_to_metric = {v: k for k, v in metric_labels.items()}

metrics = {
    "inequality_score": inequality_score,
    "max_proportion": max_proportion,
    "sum_squared_proportion": sum_squared_proportion
}

left_space, center, right_space = st.columns([1, 4, 1])
with center:
    col1, col2, col3 = st.columns([1, 1, 1])
    with col1:
        language1_label = st.selectbox("Language 1", list(label_to_lang.keys()), index=0)
    with col2:
        metric_label = st.selectbox("Metric", list(label_to_metric.keys()), index=0)
    with col3:
        language2_label = st.selectbox("Language 2", list(label_to_lang.keys()), index=1)

language1 = label_to_lang[language1_label]
language2 = label_to_lang[language2_label]
metric_name = label_to_metric[metric_label]
metric_func = metrics[metric_name]

if language1 == language2:
    st.error("Please select two different languages.")
    st.stop()

metric_func = metrics[metric_name]

results = df.groupby(language1).apply(
    lambda s: pd.Series({
        "score": metric_func(np.unique(s[language2], return_counts=True)[1]),
        "distribution": [f"{char} ({count})" for char, count in s[language2].value_counts().sort_values(ascending=False).items()]
    }),
    include_groups=False
).sort_values("score", ascending=False)

results["score"] = results["score"].round(2)


st.dataframe(
    results, use_container_width=True)

