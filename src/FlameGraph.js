/** @flow */

import type { ChartData, ChartNode, ItemData, RawData } from './types';

import React, { PureComponent } from 'react';
import { FixedSizeList as List } from 'react-window';
import memoize from 'memoize-one';
import ItemRenderer from './ItemRenderer';
import { rowHeight } from './constants';

type Props = {|
  data: ChartData,
  disableDefaultTooltips?: boolean,
  height: number,
  onChange?: (chartNode: ChartNode, uid: any) => void,
  onMouseMove?: (event: SyntheticMouseEvent<*>, node: RawData) => void,
  onMouseOut?: (event: SyntheticMouseEvent<*>, node: RawData) => void,
  onMouseOver?: (event: SyntheticMouseEvent<*>, node: RawData) => void,
  width: number,
  keyboard: boolean,
|};

type State = {|
  focusedNode: ChartNode,
  keyboardFocusedNode?: ChartNode,
|};

export default class FlameGraph extends PureComponent<Props, State> {
  // Select the root node by default.
  state: State = {
    focusedNode: this.props.data.nodes[this.props.data.root],
    keyboardFocusedNode:
      this.props.keyboard && this.props.data.nodes[this.props.data.root],
    keyboardFocusStack: this.props.keyboard && [
      this.props.data.nodes[this.props.data.root],
    ],
  };

  // Shared context between the App and individual List item renderers.
  // Memoize this wrapper object to avoid breaking PureComponent's sCU.
  // Attach the memoized function to the instance,
  // So that multiple instances will maintain their own memoized cache.
  getItemData = memoize(
    (
      data: ChartData,
      disableDefaultTooltips: boolean,
      focusedNode: ChartNode,
      keyboardFocusedNode: ChartNode,
      focusNode: (uid: any) => void,
      handleMouseEnter: (event: SyntheticMouseEvent<*>, node: RawData) => void,
      handleMouseLeave: (event: SyntheticMouseEvent<*>, node: RawData) => void,
      handleMouseMove: (event: SyntheticMouseEvent<*>, node: RawData) => void,
      width: number
    ) =>
      ({
        data,
        disableDefaultTooltips,
        focusedNode,
        keyboardFocusedNode,
        focusNode,
        handleMouseEnter,
        handleMouseLeave,
        handleMouseMove,
        scale: value => (value / focusedNode.width) * width,
      }: ItemData)
  );

  focusNode = (uid: any) => {
    const { nodes } = this.props.data;
    const chartNode = nodes[uid];
    this.setState(
      {
        focusedNode: chartNode,
      },
      () => {
        const { onChange } = this.props;
        if (typeof onChange === 'function') {
          onChange(chartNode, uid);
        }
      }
    );
  };

  focusKeyboardNode = () => {
    this.setState(
      state => {
        if (state.keyboardFocusedNode)
          return { focusedNode: state.keyboardFocusedNode };
        return null;
      },
      () => {
        const { onChange } = this.props;
        if (typeof onChange === 'function') {
          onChange(this.state.focusedNode, this.state.focusedNode.uid);
        }
      }
    );
  };

  keyboardFocusParent = () => {
    this.setState((state, props) => {
      const parentUid =
        state.keyboardFocusedNode && state.keyboardFocusedNode.parentUid;
      if (parentUid)
        return {
          keyboardFocusedNode: props.data.nodes[parentUid],
        };
      return { keyboardFocusedNode: undefined, keyboardFocusStack: [] };
    });
  };

  keyboardFocusChild = () => {
    this.setState((state, props) => {
      if (!state.keyboardFocusedNode) {
        return {
          keyboardFocusedNode: props.data.nodes[props.data.root],
          keyboardFocusStack: [props.data.nodes[props.data.root]],
        };
      }
      const newDepth = state.keyboardFocusedNode.depth + 1;
      if (
        state.keyboardFocusStack &&
        state.keyboardFocusStack.length > newDepth
      ) {
        return {
          keyboardFocusedNode: state.keyboardFocusStack[newDepth],
        };
      }
      if (!state.keyboardFocusedNode.children) {
        return null;
      }
      const child = state.keyboardFocusedNode.children[0];
      if (child) {
        return {
          keyboardFocusedNode: child,
          keyboardFocusStack: [...state.keyboardFocusStack, child],
        };
      }
      return null;
    });
  };

  keyboardFocusLast = () => {
    this.setState((state, props) => {
      if (!state.keyboardFocusedNode) return null;
      const level = props.data.levels[state.keyboardFocusedNode.depth];
      const newNode = props.data.nodes[level[level.length - 1]];
      return {
        keyboardFocusedNode: newNode,
        keyboardFocusStack: this.buildKeyboardStack(newNode, props),
      };
    });
  };

  keyboardFocusFirst = () => {
    this.setState((state, props) => {
      if (!state.keyboardFocusedNode) return null;
      const level = props.data.levels[state.keyboardFocusedNode.depth];
      const newNode = props.data.nodes[level[0]];
      return {
        keyboardFocusedNode: newNode,
        keyboardFocusStack: this.buildKeyboardStack(newNode, props),
      };
    });
  };

  buildKeyboardStack = (node: ChartNode, props: Props) => {
    let stackNode = node;
    let newParentStack = [];
    while (stackNode !== undefined) {
      newParentStack.unshift(stackNode);
      if (!stackNode.parentUid) break;
      stackNode = props.data.nodes[stackNode.parentUid];
    }
    return newParentStack;
  };

  keyboardFocusLateral = (direction: number) => {
    this.setState((state, props) => {
      if (!state.keyboardFocusedNode) {
        return {
          keyboardFocusedNode: props.data.nodes[props.data.root],
          keyboardFocusStack: [props.data.nodes[props.data.root]],
        };
      }
      const level = props.data.levels[state.keyboardFocusedNode.depth];
      const newIndex =
        level.findIndex(o => o === state.keyboardFocusedNode.uid) + direction;
      if (newIndex >= 0 && newIndex < level.length) {
        const newNode = props.data.nodes[level[newIndex]];
        if (newNode.left < state.focusedNode.left) return null;
        if (
          newNode.left + newNode.width >
          state.focusedNode.left + state.focusedNode.width
        ) {
          return null;
        }

        return {
          keyboardFocusedNode: newNode,
          keyboardFocusStack: this.buildKeyboardStack(newNode, props),
        };
      }
      return null;
    });
  };

  handleMouseEnter = (event: SyntheticMouseEvent<*>, rawData: RawData) => {
    const { onMouseOver } = this.props;
    if (typeof onMouseOver === 'function') {
      onMouseOver(event, rawData);
    }
  };

  handleMouseLeave = (event: SyntheticMouseEvent<*>, rawData: RawData) => {
    const { onMouseOut } = this.props;
    if (typeof onMouseOut === 'function') {
      onMouseOut(event, rawData);
    }
  };

  handleMouseMove = (event: SyntheticMouseEvent<*>, rawData: RawData) => {
    const { onMouseMove } = this.props;
    if (typeof onMouseMove === 'function') {
      onMouseMove(event, rawData);
    }
  };

  handleKeyDown = (event: any) => {
    console.log(event.code);
    const handlers = {
      Space: this.focusKeyboardNode,
      ArrowUp: this.keyboardFocusParent,
      ArrowDown: this.keyboardFocusChild,
      ArrowLeft: () => {
        this.keyboardFocusLateral(-1);
      },
      ArrowRight: () => {
        this.keyboardFocusLateral(1);
      },
      Home: this.keyboardFocusFirst,
      End: this.keyboardFocusLast,
    };
    const handler = handlers[event.code];
    if (handler) {
      handler();
      event.preventDefault();
    }
  };

  render() {
    const {
      data,
      disableDefaultTooltips,
      height,
      width,
      keyboard,
    } = this.props;
    const { focusedNode, keyboardFocusedNode } = this.state;

    const itemData = this.getItemData(
      data,
      !!disableDefaultTooltips,
      focusedNode,
      keyboardFocusedNode,
      this.focusNode,
      this.handleMouseEnter,
      this.handleMouseLeave,
      this.handleMouseMove,
      width
    );

    return (
      <div tabIndex={keyboard && 0} onKeyDown={keyboard && this.handleKeyDown}>
        <List
          height={height}
          innerTagName="svg"
          itemCount={data.height}
          itemData={itemData}
          itemSize={rowHeight}
          width={width}
        >
          {ItemRenderer}
        </List>
      </div>
    );
  }
}
