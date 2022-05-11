/** @flow */

import type { ChartData, ChartNode, RawData } from './types';

import { backgroundColorGradient, colorGradient } from './constants';

const backgroundColorGradientLength = backgroundColorGradient.length;
const colorGradientLength = colorGradient.length;

function getNodeBackgroundColor(value, maxValue) {
  return backgroundColorGradient[
    Math.round((value / maxValue) * (backgroundColorGradientLength - 1))
  ];
}

function getNodeColor(value, maxValue) {
  return colorGradient[
    Math.round((value / maxValue) * (colorGradientLength - 1))
  ];
}

export function transformChartData(rawData: RawData): ChartData {
  let uidCounter = 0;

  const maxValue = rawData.value;

  const nodes = {};
  const levels = [];

  function convertNode(
    sourceNode: RawData,
    depth: number,
    leftOffset: number,
    parentUid?: string
  ): ChartNode {
    const {
      backgroundColor,
      children,
      color,
      id,
      name,
      tooltip,
      value,
    } = sourceNode;

    const uidOrCounter = id || `_${uidCounter}`;

    // Add this node to the node-map and assign it a UID.
    nodes[uidOrCounter] = {
      backgroundColor:
        backgroundColor || getNodeBackgroundColor(value, maxValue),
      color: color || getNodeColor(value, maxValue),
      depth,
      left: leftOffset,
      name,
      source: sourceNode,
      tooltip,
      width: value / maxValue,
      uid: uidOrCounter,
      parentUid,
    };

    // Register the node's depth within the graph.
    if (levels.length <= depth) {
      levels.push([]);
    }
    levels[depth].push(uidOrCounter);

    // Now that the current UID has been used, increment it.
    uidCounter++;

    // Process node children.
    if (Array.isArray(children)) {
      nodes[uidOrCounter].children = children.map(sourceChildNode => {
        const targetChildNode = convertNode(
          sourceChildNode,
          depth + 1,
          leftOffset,
          uidOrCounter
        );
        leftOffset += targetChildNode.width;
        return targetChildNode;
      });
    }

    return nodes[uidOrCounter];
  }

  convertNode(rawData, 0, 0);

  const rootUid = rawData.id || '_0';

  return {
    height: levels.length,
    levels,
    nodes,
    root: rootUid,
  };
}
