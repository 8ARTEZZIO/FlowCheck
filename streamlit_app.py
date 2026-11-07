from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components


st.set_page_config(
    page_title="FlowCheck",
    page_icon="🏠",
    layout="wide",
)

demo_path = Path(__file__).with_name("FlowCheck_Open_Me.html")
if not demo_path.is_file():
    st.error("The FlowCheck standalone demo is missing.")
    st.stop()

components.html(
    demo_path.read_text(encoding="utf-8"),
    height=1200,
    scrolling=True,
)
