const host = 'http://140.112.91.60:23132/';

import { v4 as uuidv4 } from 'uuid';
import model from './diagramflow.js';

window.$ = window.jQuery = require('jquery');
require('popper.js');
require('bootstrap');
let dagre = require('dagre');
let Plotly = require('plotly.js/lib/core');

let global = {
    'trainingPid': -1,
    'folderId': 'default',
    'cfg': {},
    'graph': {},
    'flowchart': {},
};

let flowchartConfig = {
    newNodePlace: { x: 50, y: 50 },
    nodeWidth: 200,
    nodeHeight: 60,
    rectangleRenderer: (ctx, node) => {
        ctx.beginPath();
        //ctx.fillStyle = node.fillStyle;
        ctx.fillStyle = '#pink';
        ctx.strokeStyle = '1px solid black';
        ctx.fillRect(node.x, node.y, node.w, node.h);
        ctx.fillStyle = 'black';
        ctx.font = '12px monospace';
        ctx.textBaseline = 'top';
        node.textfill(ctx);
    },
    connectors: [
        new model.connector(0.5, 0, 'input', 'input', {
            fillStyle: 'DarkSeaGreen',
            strokeStyle: 'green',
            highlightStrokeStyle: 'black',
            highlightText: 'black'
        }, {
            dropAllowed: true,
            dragAllowed: false,
            radius: 7
        }),
        new model.connector(0.5, 1, 'output', 'output', {
            fillStyle: 'PowderBlue',
            strokeStyle: 'blue',
            highlightStrokeStyle: 'black',
            highlightText: 'black'
        }, {
            dropAllowed: false,
            dragAllowed: true,
            radius: 7
        }),
    ],
}

let createNode = (graph, flowchart, nodeName, nodeArgs) => {
    let index = graph.nodes.length;
    let node = {
        'index': index,
        'component': {
            'name': nodeName,
            'args': nodeArgs,
        },
    };
    graph.nodes.push(node);
    flowchart.addNode(new flowchart.node(
        flowchartConfig.newNodePlace.x,
        flowchartConfig.newNodePlace.y,
        flowchartConfig.nodeWidth,
        flowchartConfig.nodeHeight,
        flowchartConfig.connectors,
        node.component.name,
        'green',
        flowchartConfig.rectangleRenderer
    ));
    flowchartConfig.newNodePlace.x += 20;
    flowchartConfig.newNodePlace.y += 20;

    flowchart.draw();
};

let autoLayout = (nodeNum, edges, padding) => {
    let g = new dagre.graphlib.Graph();
    g.setGraph({});
    g.setDefaultEdgeLabel(function () { return {}; });
    for (let i = 0; i < nodeNum; i++) {
        g.setNode(i, { width: flowchartConfig.nodeWidth, height: flowchartConfig.nodeHeight });
    }
    edges.forEach(edge => {
        g.setEdge(edge.from, edge.to);
    });
    dagre.layout(g);
    let layout = {};
    let maxX = 0, maxY = 0, minX = 1000000, minY = 1000000;
    g.nodes().forEach(v => {
        let node = g.node(v);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        layout[parseInt(v)] = { x: node.x, y: node.y };
    });
    layout = Object.keys(layout).map(k => {
        let e = layout[k];
        return { x: (30 + e.x - minX), y: (30 + e.y - minY) }
    });
    return { width: maxX - minX + 30 + padding, height: maxY - minY + 30 + padding, nodes: layout };
};

let showNodeDetail = (nodeIndex) => {
    let info = document.getElementById('node-info');
    let node = global.graph.nodes[nodeIndex];
    let text = [
        '<form>',
        `<div class="form-group row">
            <label class="col-sm-12 col-form-label"><h4>${node.component.name}</h4></label>
        </div>`,
    ];
    Object.keys(node.component.args).forEach(k => {
        let v = node.component.args[k];
        let multipleValues = (typeof v === 'string') ? v.split(',') : [];
        if (multipleValues.length > 1) {
            text.push(`
                <div class="form-group row">
                    <label class="col-sm-6 col-form-label">${k}</label>
                    <label class="col-sm-6 col-form-label">
            `);
            text.push(multipleValues.map(e => '<span class="badge badge-success">' + e + '</span>').join('&nbsp;'));
            text.push(`
                    </label>
                </div>
            `);
        } else {
            text.push(`
            <div class="form-group row">
                <label class="col-sm-6 col-form-label">${k}</label>
                <label class="col-sm-6 col-form-label"><span class="badge badge-info">${v}</span></label>
            </div>
            `);
        }
    });

    text.push('</form>');
    info.innerHTML = text.join('\n');
};

let addAttributeRow = () => {
    let attributes = document.getElementById('nodeAttributes');
    let newAttributeName = document.getElementById('new-attribute-name').value;
    attributes.innerHTML += `
    <div class="form-group row">
        <label class="col-sm-4 col-form-label">${newAttributeName}</label>
        <div class="col-sm-5">
            <input type="text" class="form-control" name="${newAttributeName}" value="value">
        </div>
        <div class="col-sm-3">
            <a href="#" class="remove-attribute-row-button btn btn-danger btn-block">&times;</a>
        </div>
    </div>
    `;

    let btns = document.getElementsByClassName('remove-attribute-row-button');
    for (let btn of btns) {
        btn.addEventListener('click', e => {
            removeAttributeRow(e.currentTarget);
            e.preventDefault();
        });
    }
};

let removeAttributeRow = (e) => {
    let dom = e.parentElement.parentElement;
    dom.remove();
};

let showNodeEditor = (nodeIndex) => {
    let info = document.getElementById('node-info');
    let node = global.graph.nodes[nodeIndex];
    let text = [
        '<form id="modifyNode">',
        `<div class="form-group row">
            <div class="col-sm-12">
                <input type="text" class="form-control" id="node-editor-component-name" name="component-name" value="${node.component.name}">
            </div>
        </div>`,
        '<span id="nodeAttributes">',
    ];
    Object.keys(node.component.args).forEach(k => {
        let v = node.component.args[k];
        text.push(`
        <div class="form-group row">
            <label class="col-sm-4 col-form-label">${k}</label>
            <div class="col-sm-5">
                <input type="text" class="form-control" name="${k}" value="${v}">
            </div>
            <div class="col-sm-3">
                <a href="#" class="remove-attribute-row-button btn btn-danger btn-block">&times;</a>
            </div>
        </div>
        `);
    });

    text.push(`
        </span>
        <div class="form-group">
            <button type="submit" class="btn btn-primary">Save</button>
            <a href="#" id="remove-node-button" class="btn btn-danger">Delete</a>
        </div>
    </form>
    <hr>
    <form>
        <div class="from-group row">
            <label class="col-sm-4 col-form-label">attribute name</label>
            <div class="col-sm-5">
                <input type="text" class="form-control" id="new-attribute-name" value="new_attribute_name">
            </div>
            <div class="col-sm-3">
                <a href="#" id="add-attribute-row-button" class="btn btn-info btn-block">Add</a>
            </div>
        </div>
    </form>
    `);
    info.innerHTML = text.join('\n');

    document.getElementById('add-attribute-row-button').addEventListener('click', e => {
        addAttributeRow();
        e.preventDefault();
    });

    let btns = document.getElementsByClassName('remove-attribute-row-button');
    for (let btn of btns) {
        btn.addEventListener('click', e => {
            removeAttributeRow(e.currentTarget);
            e.preventDefault();
        });
    }

    document.getElementById('remove-node-button').addEventListener('click', (e) => {
        removeNodeByIndex(nodeIndex);
        e.preventDefault();
    });

    let form = document.getElementById('modifyNode');
    form.addEventListener('submit', (e) => {
        //console.log(form);
        let name = document.getElementById('node-editor-component-name').value;
        let args = {};
        let inputs = form.getElementsByTagName('input');
        for (let input of inputs) {
            if (input.name != 'component-name') {
                args[input.name] = input.value;
            }
        }
        let component = { name: name, args: args };
        node.component = component;
        showNodeDetail(nodeIndex);
        model.nodes[nodeIndex].text = name;
        e.preventDefault();
        return false;
    });
};

let removeNodeByIndex = (index) => {
    global.graph.edges = global.graph.edges.filter(e2 => !(e2.from == index || e2.to == index));
    delete global.graph.nodes[index];
    model.removeNodeByIndex(index);
    model.draw();
};

let removeEdge = (edge) => {
    global.graph.edges = global.graph.edges.filter(e2 => !(e2.from == edge.from && e2.to == edge.to));
    model.removeLinkByFromTo(edge.from, edge.to);
    model.draw();
};

let appendListenersForFlowchart = () => {
    document.addEventListener('releaseNode', () => {
        document.getElementById('node-info').innerHTML = '';
    });
    document.addEventListener('selectionChanged', e => showNodeDetail(e.detail));
    document.addEventListener('nodesLinked', (e) => {
        let edge = { from: e.detail.from, to: e.detail.to };
        // linear check if edge already existed in graph
        if (global.graph.edges.filter(e2 => e2.from == edge.from && e2.to == edge.to).length == 0) {
            global.graph.edges.push(edge);
        }
    });
    document.addEventListener('clickNode', e => showNodeEditor(e.detail));

    document.addEventListener('clickLink', (e) => {
        let edge = { from: e.detail.from, to: e.detail.to };
        removeEdge(edge);
    });
};

let initFlowchart = (graph) => {
    model.clear();
    let layout = autoLayout(graph.nodes.length, graph.edges, 200);
    graph.nodes.forEach(node => {
        model.addNode(new model.node(
            layout.nodes[node.index].x,
            layout.nodes[node.index].y,
            flowchartConfig.nodeWidth,
            flowchartConfig.nodeHeight,
            flowchartConfig.connectors,
            node.component.name,
            'green',
            flowchartConfig.rectangleRenderer
        ));
    });
    graph.edges.forEach(edge => {
        model.addLink(new model.link(edge.from, edge.to, 1, 0, ''));
    });

    document.getElementById('myCanvas').width = document.getElementById('myCanvas').parentElement.clientWidth;
    document.getElementById('myCanvas').height = Math.max(700, layout.height);
    model.init('myCanvas');
    model.draw();

    appendListenersForFlowchart();

    return model;
};

let buildGraph = (components) => {
    let nodes = [], edges = [];
    components.forEach((component, index) => {
        nodes.push({ 'index': index, 'component': component });
        if (index > 0) {
            switch (component.name) {
                case 'shortcut':
                    if (component.args.from != null) {
                        let fromIndex = index + parseInt(component.args.from);
                        edges.push({ 'from': fromIndex, 'to': index });
                        edges.push({ 'from': index - 1, 'to': index });
                    }
                    break;
                case 'route':
                    if (component.args.layers != null) {
                        component.args.layers.split(',')
                            .map(e => e.trim())
                            .filter(e => !(!e || e.length === 0 || !e.trim()))
                            .forEach(layer => {
                                let layerIndex = parseInt(layer);
                                if (layerIndex >= 0) {
                                    edges.push({ 'from': layerIndex, 'to': index });
                                } else {
                                    edges.push({ 'from': index + layerIndex, 'to': index });
                                }
                            });
                    }
                    break;
                default:
                    edges.push({ 'from': index - 1, 'to': index });
            }
        }
    });
    return { 'nodes': nodes, 'edges': edges };
};

let formatGraph = (graph) => {
    let renumber = (nodes, edges) => {
        let fromTo = Array(nodes.length).fill(null).map(e => new Array(0));
        let degrees = Array(nodes.length).fill(0);
        edges.forEach(edge => {
            fromTo[edge.from].push(edge.to);
            degrees[edge.to] += 1;
        });

        let roots = degrees
            .map((d, i) => { return { index: i, degree: d } })
            .filter(e => e.degree == 0)
            .filter(e => nodes[e.index]);
        if (roots.length == 0) {
            throw 'root layer does not exist!';
        } else if (roots.length > 1) {
            throw 'there are multiple inputs!';
        } else if (nodes[roots[0].index].component.name != 'net') {
            throw 'root layer is not net!';
        }

        let indexMap = Array(nodes.length).fill(-1);
        let stack = [roots[0].index];
        let counter = 0;
        while (stack.length > 0) {
            let from = stack.pop();

            // map old index to new index
            indexMap[from] = counter;
            counter += 1;

            let shortcuts = [], routes = [], others = [];
            fromTo[from].forEach(to => {
                degrees[to] -= 1;
                if (degrees[to] == 0) {
                    switch (nodes[to].component.name) {
                        case 'shortcut':
                            shortcuts.push(to);
                            break;
                        case 'route':
                            routes.push(to);
                            break;
                        default:
                            others.push(to);
                    }
                }
            });

            // priority: others > shortcut > route
            routes.forEach(e => stack.push(e));
            shortcuts.forEach(e => stack.push(e));
            others.forEach(e => stack.push(e));
        }

        if (degrees.filter(d => d > 0).length > 0) {
            throw 'There is cycle in the flowchart!';
        }

        let newNodes = Array(nodes.length).fill(null);
        nodes.filter(e => e).forEach(node => {
            let newIndex = indexMap[node.index];
            newNodes[newIndex] = {
                index: newIndex,
                component: node.component,
            };
        });
        newNodes = newNodes.filter(e => e);

        let newEdges = new Set();
        edges.forEach(edge => {
            newEdges.add({ from: indexMap[edge.from], to: indexMap[edge.to] });
        });

        return { nodes: newNodes, edges: newEdges };
    };

    let rebuildNodes = (nodes, edges) => {
        let fromEdges = Array(nodes.length).fill(null).map(e => new Array(0));
        edges.forEach(edge => {
            fromEdges[edge.to].push(edge.from);
        });
        let newNodes = nodes.map(node => {
            let inputIndices = fromEdges[node.index];

            delete node.component.args.from;
            delete node.component.args.layers;

            switch (node.component.name) {
                case 'net':
                    if (inputIndices.length > 0) {
                        throw 'net should not have input!';
                    }
                    break;
                case 'shortcut':
                    if (inputIndices.length != 2) {
                        throw 'shortcut must have 2 inputs!';
                    }
                    if (inputIndices[0] == node.index - 1) {
                        let indexDiff = inputIndices[1] - node.index;
                        if (indexDiff >= 0) {
                            throw 'shortcut must have previous layer as input!';
                        }
                        node.component.args.from = indexDiff;
                    } else if (inputIndices[1] == node.index - 1) {
                        let indexDiff = inputIndices[0] - node.index;
                        if (indexDiff >= 0) {
                            throw 'shortcut must have previous layer as input!';
                        }
                        node.component.args.from = indexDiff;
                    } else {
                        throw 'shortcut must have previous layer as input!';
                    }
                    break;
                case 'route':
                    if (inputIndices.length == 0) {
                        throw 'route must have input!';
                    }
                    node.component.args.layers = inputIndices
                        .map(i => {
                            let indexDiff = i - node.index;
                            if (indexDiff < 0) {
                                return indexDiff;
                            } else if (indexDiff == 0) {
                                throw 'route should not have itself as input!';
                            } else {
                                return i;
                            }
                        })
                        .join(',');
                    break;
                default:
                    if (inputIndices.length != 1) {
                        throw (node.component.name + ' must have 1 input!');
                    }
                    if (inputIndices[0] != node.index - 1) {
                        throw (node.component.name + ' must have previous layer as input!');
                    }
            }
            return node;
        });
        return newNodes;
    };

    let g = renumber(graph.nodes, graph.edges);
    if (g == null) {
        throw 'fail to renumber graph!';
    }
    let newNodes = rebuildNodes(g.nodes, g.edges);
    return { nodes: newNodes, edges: g.edges };
};

let exportCfg = () => {
    try {
        document.getElementById('cfg').value = '';
        let newGraph = formatGraph(global.graph);
        let str = newGraph.nodes.map(node => {
            let argsStr = Object.keys(node.component.args).map(k => {
                return k + '=' + node.component.args[k];
            }).join('\n');
            return '[' + node.component.name + ']\n' + argsStr;
        }).join('\n\n');

        document.getElementById('cfg').value = str;
    } catch (e) {
        document.getElementById('error-message').innerHTML += `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            ${e}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
            </button>
        </div>
        `;
    }
};

let importCfg = () => {
    global.cfg = document.getElementById('cfg').value;
    global.graph = buildGraph(parseCfg(global.cfg));
    console.log(global.graph);
    global.flowchart = initFlowchart(global.graph);
};

let clearDashboard = () => {
    document.getElementById('node-info').innerHTML = '';
    global.cfg = document.getElementById('cfg').value = `[net]
batch = 1
learning_rate = .001
momentum = .9
decay = .0001
subdivisions = 1
time_steps = 1
notruth = 0
random = 0
adam = 0
B1 = .9
B2 = .999
eps = .0000001
height = 0
width = 0
channels = 0
inputs = 0
max_crop = 0
min_crop = 0
max_ratio = 0
min_ratio = 0
center = 0
clip = 0
angle = 0
aspect = 1
saturation = 1
exposure = 1
hue = 0
policy = steps
burn_in = 0
power = 4
steps = 1,1
scales = 1,1
gamma = 1
max_batches = 0
`;
    global.graph = buildGraph(parseCfg(global.cfg));
    global.flowchart = initFlowchart(global.graph);
};

let parseCfg = (cfg) => {
    let components = cfg.replace(/\#.*/g, '').replace(/\[(.*?)\]/g, '\0$1\n')
        .split('\0')
        .filter(e => !(!e || e.length === 0 || !e.trim()))
        .map(e => {
            let s = e.split(/\n|\r/).filter(e => !(!e || e.length === 0 || !e.trim()));
            if (s.length > 0 && s[0].trim().length > 0) {
                let name = s[0].trim();
                let args = {};
                for (let i = 1; i < s.length; i++) {
                    let t = s[i].split('=');
                    if (t.length == 2 && t[0].trim().length > 0 && t[1].trim().length > 0) {
                        args[t[0].trim()] = t[1].trim();
                    }
                }
                return { 'name': name, 'args': args };
            }
            return null;
        })
        .filter(e => e);
    return components;
};

let createFolder = () => {
    global.folderId = uuidv4();
    const xhr = new XMLHttpRequest();
    const url = host + 'create/' + global.folderId;
    xhr.open("POST", url);
    xhr.send();
};

let startTraining = () => {
    const xhr = new XMLHttpRequest();
    const url = host + 'train/' + global.folderId;
    xhr.open('POST', url);
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
            let pid = parseInt(xhr.responseText);
            global.trainingPid = pid;
        }
    };
    xhr.send();
};

let stopTraining = () => {
    const xhr = new XMLHttpRequest();
    const url = host + 'stop/training/' + global.trainingPid;
    xhr.open('POST', url);
    xhr.send();
};

let saveConfig = (cfg) => {
    const xhr = new XMLHttpRequest();
    const url = host + 'cfg/' + global.folderId;
    let formData = new FormData();
    formData.append('data', cfg);
    xhr.open("POST", url);
    xhr.send(formData);
};

let plotLoss = () => {
    const xhr = new XMLHttpRequest();
    const url = host + 'log/' + global.folderId;
    xhr.open('GET', url);
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4) {
            let data = JSON.parse(xhr.responseText);
            let plotLoss = () => {
                let x = [], y = [];
                data.forEach(d => {
                    x.push(d.iter_num);
                    y.push(d.loss);
                });
                let plotCanvas = document.createElement('div');
                Plotly.plot(plotCanvas, [{
                    x: x,
                    y: y,
                    marker: {
                        color: 'DodgerBlue'
                    }
                }], {
                    margin: { t: 1 },
                    width: 400,
                    height: 400,
                });
                let wrapper = document.getElementById('loss-plot');
                wrapper.innerHTML = '';
                wrapper.appendChild(plotCanvas);
            };
            let plotLearning = () => {
                let x = [], y = [];
                data.forEach(d => {
                    x.push(d.iter_num);
                    y.push(d.learning_rate);
                });
                let plotCanvas = document.createElement('div');
                plotCanvas.innerHTML = '';
                Plotly.plot(plotCanvas, [{
                    x: x,
                    y: y,
                    marker: {
                        color: 'DodgerBlue'
                    }
                }], {
                    margin: { t: 1 },
                    width: 400,
                    height: 400,
                });
                let wrapper = document.getElementById('learning-plot');
                wrapper.innerHTML = '';
                wrapper.appendChild(plotCanvas);
            };
            plotLoss();
            plotLearning();
        }
    };
    xhr.send();
};

let setupCreateNodeButtons = (wrapper) => {
    let defaultOptions = {
        'truth': 0,
        'onlyforward': 0,
        'stopbackward': 0,
        'dontsave': 0,
        'dontload': 0,
        'numload': 0,
        'dontloadscales': 0,
        'learning_rate': 1,
        'smooth': 0,
    };
    let allTypes = [
        {
            name: 'logistic', args: {}
        }, {
            name: 'l2norm', args: {}
        }, {
            name: 'network', args: {}
        }, {
            name: 'avgpool', args: {}
        }, {
            name: 'batchnorm', args: {}
        }, {
            name: 'route', args: {}
        },
        {
            name: 'local', args: {
                'filters': 1,
                'size': 1,
                'stride': 1,
                'pad': 0,
                'activation': "logistic",
            }
        }, {
            name: 'deconvolutional', args: {
                'filters': 1,
                'size': 1,
                'stride': 1,
                'activation': "logistic",
                'batch_normalize': 0,
                'pad': 0,
                'padding': 0,
            }
        }, {
            name: 'convolutional', args: {
                'filters': 1,
                'size': 1,
                'stride': 1,
                'pad': 0,
                'padding': 0,
                'groups': 1,
                'activation': "logistic",
                'batch_normalize': 0,
                'binary': 0,
                'xnor': 0,
                'flipped': 0,
                'dot': 0,
            }
        }, {
            name: 'crnn', args: {
                'output_filters': 1,
                'hidden_filters': 1,
                'activation': "logistic",
                'batch_normalize': 0,
                'shortcut': 0,
            }
        }, {
            name: 'rnn', args: {
                'output': 1,
                'activation': "logistic",
                'batch_normalize': 0,
                'shortcut': 0,
            }
        }, {
            name: 'gru', args: {
                'output': 1,
                'batch_normalize': 0,
                'tanh': 0,
            }
        }, {
            name: 'lstm', args: {
                'output': 1,
                'batch_normalize': 0,
            }
        }, {
            name: 'connected', args: {
                'output': 1,
                'activation': "logistic",
                'batch_normalize': 0,
            }
        }, {
            name: 'softmax', args: {
                'groups': 1,
                'temperature': 1,
                'tree': 0,
                'spatial': 0,
                'noloss': 0,
            }
        }, {
            name: 'yolo', args: {
                'classes': 20,
                'num': 1,
                'mask': 0,
                'max': 90,
                'jitter': .2,
                'ignore_thresh': .5,
                'truth_thresh': 1,
                'random': 0,
                'map': 0,
                'anchors': 0,
            }
        }, {
            name: 'iseg', args: {
                'classes': 20,
                'ids': 32,
            }
        }, {
            name: 'region', args: {
                'coords': 4,
                'classes': 20,
                'num': 1,
                'log': 0,
                'sqrt': 0,
                'softmax': 0,
                'background': 0,
                'max': 30,
                'jitter': .2,
                'rescore': 0,
                'thresh': .5,
                'classfix': 0,
                'absolute': 0,
                'random': 0,
                'coord_scale': 1,
                'object_scale': 1,
                'noobject_scale': 1,
                'mask_scale': 1,
                'class_scale': 1,
                'bias_match': 0,
                'tree': 0,
                'map': 0,
                'anchors': 0,
            }
        }, {
            name: 'detection', args: {
                'coords': 1,
                'classes': 1,
                'rescore': 0,
                'num': 1,
                'side': 7,
                'softmax': 0,
                'sqrt': 0,
                'max': 90,
                'coord_scale': 1,
                'forced': 0,
                'object_scale': 1,
                'noobject_scale': 1,
                'class_scale': 1,
                'jitter': .2,
                'random': 0,
                'reorg': 0,
            }
        }, {
            name: 'cost', args: {
                'type': "sse",
                'scale': 1,
                'ratio': 0,
                'noobj': 1,
                'thresh': 0,
            }
        }, {
            name: 'crop', args: {
                'crop_height': 1,
                'crop_width': 1,
                'flip': 0,
                'angle': 0,
                'saturation': 1,
                'exposure': 1,
                'noadjust': 0,
                'shift': 0,
            }
        }, {
            name: 'reorg', args: {
                'stride': 1,
                'reverse': 0,
                'flatten': 0,
                'extra': 0,
            }
        }, {
            name: 'maxpool', args: {
                'stride': 1,
                'size': 1,
                'padding': 0,
            }
        }, {
            name: 'dropout', args: {
                'probability': .5,
            }
        }, {
            name: 'normalization', args: {
                'alpha': .0001,
                'beta': .75,
                'kappa': 1,
                'size': 5,
            }
        }, {
            name: 'shortcut', args: {
                'activation': "linear",
                'alpha': 1,
                'beta': 1,
            }
        }, {
            name: 'activation', args: {
                'activation': "linear",
            }
        }, {
            name: 'upsample', args: {
                'stride': 2,
                'scale': 1,
            }
        }
    ];
    allTypes.forEach(t => {
        let args = {};
        Object.keys(defaultOptions).forEach(k => {
            args[k] = defaultOptions[k];
        });
        Object.keys(t.args).forEach(k => {
            args[k] = t.args[k];
        });
        let button = document.createElement('a');
        button.innerText = t.name;
        button.href = '#';
        button.classList.add('btn');
        button.classList.add('btn-primary');
        button.addEventListener('click', e => {
            createNode(global.graph, global.flowchart, t.name, args);
            $('#create-layer-modal').modal('hide');
            e.preventDefault();
        });
        wrapper.appendChild(button);
        wrapper.append(' ');
    });
};

let setupButtons = () => {
    document.getElementById('import-button').addEventListener('click', (e) => {
        exportCfg();
        e.preventDefault();
    });

    document.getElementById('export-button').addEventListener('click', (e) => {
        importCfg();
        e.preventDefault();
    });

    document.getElementById('clear-dashboard-button').addEventListener('click', (e) => {
        clearDashboard();
        e.preventDefault();
    });

    // document.getElementById('create-node-button').addEventListener('click', (e) => {
    //     createNode(global.graph, global.flowchart, 'n', { 'a': '' });
    //     e.preventDefault();
    // });

    document.getElementById('save-config-button').addEventListener('click', (e) => {
        global.cfg = document.getElementById('cfg').value;
        saveConfig(global.cfg);
        e.preventDefault();
    });

    document.getElementById('start-training-button').addEventListener('click', (e) => {
        startTraining();
        e.preventDefault();
    });

    document.getElementById('stop-training-button').addEventListener('click', (e) => {
        stopTraining();
        e.preventDefault();
    });

    document.getElementById('to-training-link').addEventListener('click', (e) => {
        document.getElementById('editor').style.display = 'none';
        document.getElementById('training').style.display = null;
        document.getElementById('testing').style.display = 'none';
        document.getElementById('dataset').style.display = 'none';
        plotLoss();
        e.preventDefault();
    });

    document.getElementById('to-editor-link').addEventListener('click', (e) => {
        document.getElementById('editor').style.display = null;
        document.getElementById('training').style.display = 'none';
        document.getElementById('testing').style.display = 'none';
        document.getElementById('dataset').style.display = 'none';
        e.preventDefault();
    });

    document.getElementById('to-testing-link').addEventListener('click', (e) => {
        document.getElementById('editor').style.display = 'none';
        document.getElementById('training').style.display = 'none';
        document.getElementById('testing').style.display = null;
        document.getElementById('dataset').style.display = 'none';
        e.preventDefault();
    });

    document.getElementById('to-dataset-link').addEventListener('click', (e) => {
        document.getElementById('editor').style.display = 'none';
        document.getElementById('training').style.display = 'none';
        document.getElementById('testing').style.display = 'none';
        document.getElementById('dataset').style.display = null;
        e.preventDefault();
    });

    setupCreateNodeButtons(document.getElementById('create-nodes'));
};

window.onload = () => {
    // init
    createFolder();
    document.getElementById('editor').style.display = null;
    document.getElementById('training').style.display = 'none';
    clearDashboard();
    setupButtons();
};
