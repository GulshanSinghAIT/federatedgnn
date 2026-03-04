"""Graph builder: constructs NetworkX graph from database records."""
import networkx as nx
import json


def build_knowledge_graph(diseases, symptoms, treatments, 
                           symptom_diseases, treatment_diseases,
                           disease_comorbidities, patients=None,
                           patient_symptoms=None, patient_diseases=None):
    """Build a full knowledge graph from database records.
    
    Returns a NetworkX graph with typed nodes and weighted edges.
    """
    G = nx.Graph()
    
    # Add disease nodes
    for d in diseases:
        G.add_node(d.id, type="disease", label=d.name, 
                   icd10_code=d.icd10_code, category=d.category, 
                   prevalence=d.prevalence)
    
    # Add symptom nodes
    for s in symptoms:
        G.add_node(s.id, type="symptom", label=s.name,
                   body_system=s.body_system, severity_weight=s.severity_weight)
    
    # Add treatment nodes
    for t in treatments:
        G.add_node(t.id, type="treatment", label=t.name,
                   treatment_type=t.type, evidence_level=t.evidence_level)
    
    # Add INDICATES edges (symptom -> disease)
    for sd in symptom_diseases:
        G.add_edge(sd.symptom_id, sd.disease_id, 
                   type="INDICATES", weight=sd.weight)
    
    # Add TREATS edges (treatment -> disease)
    for td in treatment_diseases:
        G.add_edge(td.treatment_id, td.disease_id,
                   type="TREATS", weight=td.efficacy)
    
    # Add COMORBID_WITH edges (disease -> disease)
    for dc in disease_comorbidities:
        G.add_edge(dc.disease_id_1, dc.disease_id_2,
                   type="COMORBID_WITH", weight=dc.correlation)
    
    # Add patient nodes and HAS_SYMPTOM edges
    if patients:
        for p in patients:
            G.add_node(p.id, type="patient", label=f"Patient {p.id[:8]}",
                       hospital_id=p.hospital_id, age_group=p.age_group,
                       sex=p.sex, ethnicity=p.ethnicity)
    
    if patient_symptoms:
        for ps in patient_symptoms:
            G.add_edge(ps.patient_id, ps.symptom_id,
                       type="HAS_SYMPTOM", weight=ps.severity / 10.0)
    
    if patient_diseases:
        for pd in patient_diseases:
            G.add_edge(pd.patient_id, pd.disease_id,
                       type="DIAGNOSED_WITH", weight=pd.confidence)
    
    return G


def graph_to_json(G):
    """Convert NetworkX graph to JSON-serializable dict."""
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "type": data.get("type", "unknown"),
            "label": data.get("label", node_id),
            "properties": {k: v for k, v in data.items() if k not in ("type", "label")}
        })
    
    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "type": data.get("type", "UNKNOWN"),
            "weight": data.get("weight", 1.0)
        })
    
    return {"nodes": nodes, "edges": edges}


def get_patient_subgraph(G, patient_id: str, depth: int = 2):
    """Extract subgraph around a patient node."""
    if patient_id not in G:
        return {"nodes": [], "edges": []}
    
    # BFS to collect nodes within depth
    visited = {patient_id}
    frontier = {patient_id}
    
    for _ in range(depth):
        next_frontier = set()
        for node in frontier:
            for neighbor in G.neighbors(node):
                if neighbor not in visited:
                    visited.add(neighbor)
                    next_frontier.add(neighbor)
        frontier = next_frontier
    
    subgraph = G.subgraph(visited)
    return graph_to_json(subgraph)


def get_disease_neighborhood(G, disease_id: str):
    """Get disease node with its symptom and treatment neighbors."""
    if disease_id not in G:
        return {"nodes": [], "edges": []}
    
    neighbors = set(G.neighbors(disease_id))
    neighbors.add(disease_id)
    subgraph = G.subgraph(neighbors)
    return graph_to_json(subgraph)
