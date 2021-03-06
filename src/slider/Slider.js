import PropTypes from 'prop-types';
import React, {Component} from 'react';
import {View, StyleSheet, Animated, Easing, PanResponder, Text} from 'react-native';
import ViewPropTypes from '../config/ViewPropTypes';
import colors from '../config/colors';
import Icon from 'react-native-vector-icons/FontAwesome'

const TRACK_SIZE = 4;
const THUMB_SIZE = 20;

var DEFAULT_ANIMATION_CONFIGS = {
  spring: {
    friction: 7,
    tension: 100,
  },
  timing: {
    duration: 150,
    easing: Easing.inOut(Easing.ease),
    delay: 0,
  },
};

function Rect(x, y, width, height)
{
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

Rect.prototype.containsPoint = function (x, y)
{
  return (
    x >= this.x &&
    y >= this.y &&
    x <= this.x + this.width &&
    y <= this.y + this.height
  );
};

export default class Slider extends Component
{
  constructor(props)
  {
    super(props);
    this.state = {
      containerSize: {width: 0, height: 0},
      trackSize: {width: 0, height: 0},
      thumbSize: {width: 0, height: 0},
      allMeasured: false,
      value: new Animated.Value(props.value),
    };
  }

  componentWillMount()
  {
    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: this.handleStartShouldSetPanResponder.bind(
        this
      ),
      onMoveShouldSetPanResponder: this.handleMoveShouldSetPanResponder.bind(
        this
      ),
      onPanResponderGrant: this.handlePanResponderGrant.bind(this),
      onPanResponderMove: this.handlePanResponderMove.bind(this),
      onPanResponderRelease: this.handlePanResponderEnd.bind(this),
      onPanResponderTerminationRequest: this.handlePanResponderRequestEnd.bind(
        this
      ),
      onPanResponderTerminate: this.handlePanResponderEnd.bind(this),
    });
  }

  componentWillReceiveProps(nextProps)
  {
    var newValue = nextProps.value;

    if (this.props.value !== newValue)
    {
      if (this.props.animateTransitions)
      {
        this.setCurrentValueAnimated(newValue);
      } else
      {
        this.setCurrentValue(newValue);
      }
    }
  }

  setCurrentValue(value)
  {
    this.state.value.setValue(value);
  }

  setCurrentValueAnimated(value)
  {
    var animationType = this.props.animationType;
    var animationConfig = Object.assign(
      {},
      DEFAULT_ANIMATION_CONFIGS[animationType],
      this.props.animationConfig,
      {
        toValue: value,
      }
    );

    Animated[animationType](this.state.value, animationConfig).start();
  }

  handleMoveShouldSetPanResponder(/*e: Object, gestureState: Object*/)
  {
    // Should we become active when the user moves a touch over the thumb?
    return false;
  }

  handlePanResponderGrant(/*e: Object, gestureState: Object*/)
  {
    this._previousLeft = this.getThumbLeft(this.getCurrentValue());
    this.fireChangeEvent('onSlidingStart');
  }

  handlePanResponderMove(e, gestureState)
  {
    if (this.props.disabled)
    {
      return;
    }

    this.setCurrentValue(this.getValue(gestureState));
    this.fireChangeEvent('onValueChange');
  }

  handlePanResponderRequestEnd()
  {
    // Should we allow another component to take over this pan?
    return false;
  }

  handlePanResponderEnd(e, gestureState)
  {
    if (this.props.disabled)
    {
      return;
    }

    this.setCurrentValue(this.getValue(gestureState));
    this.fireChangeEvent('onSlidingComplete');
  }

  thumbHitTest(e)
  {
    var nativeEvent = e.nativeEvent;
    var thumbTouchRect = this.getThumbTouchRect();
    return thumbTouchRect.containsPoint(
      nativeEvent.locationX,
      nativeEvent.locationY
    );
  }

  handleStartShouldSetPanResponder(e /*gestureState: Object*/)
  {
    // Should we become active when the user presses down on the thumb?
    return this.thumbHitTest(e);
  }

  fireChangeEvent(event)
  {
    if (this.props[event])
    {
      this.props[event](this.getCurrentValue());
    }
  }

  getTouchOverflowSize()
  {
    var state = this.state;
    var props = this.props;

    var size = {};
    if (state.allMeasured === true)
    {
      size.width = Math.max(
        0,
        props.thumbTouchSize.width - state.thumbSize.width
      );
      size.height = Math.max(
        0,
        props.thumbTouchSize.height - state.containerSize.height
      );
    }

    return size;
  }

  getTouchOverflowStyle()
  {
    var {width, height} = this.getTouchOverflowSize();

    var touchOverflowStyle = {};
    if (width !== undefined && height !== undefined)
    {
      var verticalMargin = -height / 2;
      touchOverflowStyle.marginTop = verticalMargin;
      touchOverflowStyle.marginBottom = verticalMargin;

      var horizontalMargin = -width / 2;
      touchOverflowStyle.marginLeft = horizontalMargin;
      touchOverflowStyle.marginRight = horizontalMargin;
    }

    if (this.props.debugTouchArea === true)
    {
      touchOverflowStyle.backgroundColor = 'orange';
      touchOverflowStyle.opacity = 0.5;
    }

    return touchOverflowStyle;
  }

  handleMeasure(name, x)
  {
    var {width, height} = x.nativeEvent.layout;
    var size = {width: width, height: height};

    var storeName = `_${name}`;
    var currentSize = this[storeName];
    if (
      currentSize &&
      width === currentSize.width &&
      height === currentSize.height
    )
    {
      return;
    }
    this[storeName] = size;

    if (this._containerSize && this._trackSize && this._thumbSize)
    {
      this.setState({
        containerSize: this._containerSize,
        trackSize: this._trackSize,
        thumbSize: this._thumbSize,
        allMeasured: true,
      });
    }
  }

  measureContainer(x)
  {
    this.handleMeasure('containerSize', x);
  }

  measureTrack(x)
  {
    this.handleMeasure('trackSize', x);
  }

  measureThumb(x)
  {
    this.handleMeasure('thumbSize', x);
  }

  getValue(gestureState)
  {
    var length = this.state.containerSize.width - this.state.thumbSize.width;
    var thumbLeft = this._previousLeft + gestureState.dx;

    var ratio = thumbLeft / length;

    if (this.props.step)
    {
      return Math.max(
        this.props.minimumValue,
        Math.min(
          this.props.maximumValue,
          this.props.minimumValue +
          Math.round(
            ratio *
            (this.props.maximumValue - this.props.minimumValue) /
            this.props.step
          ) *
          this.props.step
        )
      );
    } else
    {
      return Math.max(
        this.props.minimumValue,
        Math.min(
          this.props.maximumValue,
          ratio * (this.props.maximumValue - this.props.minimumValue) +
          this.props.minimumValue
        )
      );
    }
  }

  getCurrentValue()
  {
    return this.state.value.__getValue();
  }

  getRatio(value)
  {
    return (
      (value - this.props.minimumValue) /
      (this.props.maximumValue - this.props.minimumValue)
    );
  }

  getThumbLeft(value)
  {
    var ratio = this.getRatio(value);
    return (
      ratio * (this.state.containerSize.width - this.state.thumbSize.width)
    );
  }

  getThumbTouchRect()
  {
    var state = this.state;
    var props = this.props;
    var touchOverflowSize = this.getTouchOverflowSize();

    return new Rect(
      touchOverflowSize.width / 2 +
      this.getThumbLeft(this.getCurrentValue()) +
      (state.thumbSize.width - props.thumbTouchSize.width) / 2,
      touchOverflowSize.height / 2 +
      (state.containerSize.height - props.thumbTouchSize.height) / 2,
      props.thumbTouchSize.width,
      props.thumbTouchSize.height
    );
  }

  renderDebugThumbTouchRect(thumbLeft)
  {
    var thumbTouchRect = this.getThumbTouchRect();
    var positionStyle = {
      left: thumbLeft,
      top: thumbTouchRect.y,
      width: thumbTouchRect.width,
      height: thumbTouchRect.height,
    };
    return <Animated.View style={positionStyle} pointerEvents="none"/>;
  }

  renderPhaseSlider()
  {
    let phaseItems = [];
    let currentRatio = this.getRatio(this.getCurrentValue());

    for (let i = 0; i <= (this.props.maximumValue / this.props.step); i++)
    {
      let sliderColor = colors.sliderRight;
      let elementRatio = this.getRatio(i * this.props.step);

      if (elementRatio < currentRatio)
        sliderColor = colors.sliderLeft;

      phaseItems.push(<View key={'phase_' + i} style={[styles.phaseSliderItem, {backgroundColor: sliderColor}]} />);
    }

    return phaseItems;
  }

  render()
  {
    const {
      minimumValue,
      maximumValue,
      minimumTrackTintColor,
      maximumTrackTintColor,
      thumbTintColor,
      containerStyle,
      style,
      trackStyle,
      thumbStyle,
      debugTouchArea,
      ...other
    } = this.props;

    var {
      value,
      containerSize,
      trackSize,
      thumbSize,
      allMeasured,
    } = this.state;

    var mainStyles = containerStyle || styles;
    var thumbLeft = value.interpolate({
      inputRange: [minimumValue, maximumValue],
      outputRange: [0, containerSize.width - thumbSize.width],
      //extrapolate: 'clamp',
    });

    var valueVisibleStyle = {};
    if (!allMeasured)
    {
      valueVisibleStyle.opacity = 0;
    }

    var minimumTrackStyle = {
      position: 'absolute',
      width: Animated.add(thumbLeft, thumbSize.width / 2),
      marginTop: -trackSize.height,
      backgroundColor: minimumTrackTintColor,
      ...valueVisibleStyle,
    };

    let touchOverflowStyle = this.getTouchOverflowStyle();
    let itemStyle = [defaultItemStyles.item, this.props.itemStyle];
    let itemWrapper = (this.props.icons) ? [defaultItemStyles.itemWrapper, {paddingLeft: 10, paddingRight: 15}] : [defaultItemStyles.itemWrapper];

    return (
      <View>
        {this.props.items && <View style={itemWrapper}>
          {
            this.props.items.map(function (i, j)
            {
              return <Text key={i.value} ref={"t" + j} style={itemStyle}>{i.label}</Text>;
            })
          }
        </View>
        }
        <View style={styles.sliderIconContainer}>
          {this.props.icons && <Icon style={defaultIconStyles.iconLeft} name={this.props.icons.left} size={26} />}
          <View
            {...other}
            style={[mainStyles.container, style]}
            onLayout={this.measureContainer.bind(this)}
          >
            {this.props.phase && <View style={[itemWrapper, [styles.phaseSliderContainer]]}>
              {
                this.renderPhaseSlider()
              }
            </View>}
            <View
              style={[
                {backgroundColor: maximumTrackTintColor},
                mainStyles.track,
                trackStyle,
                this.props.disabled && styles.disabled
              ]}
              onLayout={this.measureTrack.bind(this)}
            />
            <Animated.View
              style={[mainStyles.track, trackStyle, minimumTrackStyle, this.props.disabled && styles.disabled]}
            />
            <View style={styles.thumbTopShadow}>
              <View style={styles.thumbBottomShadow}>
                <Animated.View
                  onLayout={this.measureThumb.bind(this)}
                  style={[
                    {backgroundColor: thumbTintColor},
                    mainStyles.thumb,
                    thumbStyle,
                    {
                      transform: [
                        {translateX: thumbLeft},
                        {translateY: -(trackSize.height + thumbSize.height) / 2},
                      ],
                      ...valueVisibleStyle,
                    },
                  ]}
                />
              </View>
            </View>
            <View
              style={[styles.touchArea, touchOverflowStyle]}
              {...this.panResponder.panHandlers}
            >
              {debugTouchArea === true && this.renderDebugThumbTouchRect(thumbLeft)}
            </View>
          </View>
          {this.props.icons && <Icon style={defaultIconStyles.iconRight} name={this.props.icons.right} size={26} />}
        </View>
      </View>
    );
  }
}

Slider.propTypes = {
  /**
   * Initial value of the slider. The value should be between minimumValue
   * and maximumValue, which default to 0 and 1 respectively.
   * Default value is 0.
   *
   * *This is not a controlled component*, e.g. if you don't update
   * the value, the component won't be reset to its inital value.
   */
  value: PropTypes.number,

  /**
   * If true the user won't be able to move the slider.
   * Default value is false.
   */
  disabled: PropTypes.bool,

  /**
   * Initial minimum value of the slider. Default value is 0.
   */
  minimumValue: PropTypes.number,

  /**
   * Initial maximum value of the slider. Default value is 1.
   */
  maximumValue: PropTypes.number,

  /**
   * Step value of the slider. The value should be between 0 and
   * (maximumValue - minimumValue). Default value is 0.
   */
  step: PropTypes.number,

  /**
   * The color used for the track to the left of the button. Overrides the
   * default blue gradient image.
   */
  minimumTrackTintColor: PropTypes.string,

  /**
   * The color used for the track to the right of the button. Overrides the
   * default blue gradient image.
   */
  maximumTrackTintColor: PropTypes.string,

  /**
   * The color used for the thumb.
   */
  thumbTintColor: PropTypes.string,

  /**
   * The size of the touch area that allows moving the thumb.
   * The touch area has the same center has the visible thumb.
   * This allows to have a visually small thumb while still allowing the user
   * to move it easily.
   * The default is {width: 40, height: 40}.
   */
  thumbTouchSize: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),

  /**
   * Callback continuously called while the user is dragging the slider.
   */
  onValueChange: PropTypes.func,

  /**
   * Callback called when the user starts changing the value (e.g. when
   * the slider is pressed).
   */
  onSlidingStart: PropTypes.func,

  /**
   * Callback called when the user finishes changing the value (e.g. when
   * the slider is released).
   */
  onSlidingComplete: PropTypes.func,

  /**
   * The style applied to the slider container.
   */
  style: ViewPropTypes.style,

  /**
   * The style applied to the track.
   */
  trackStyle: ViewPropTypes.style,

  /**
   * The style applied to the thumb.
   */
  thumbStyle: ViewPropTypes.style,

  /**
   * Set this to true to visually see the thumb touch rect in green.
   */
  debugTouchArea: PropTypes.bool,

  /**
   * Set to true to animate values with default 'timing' animation type
   */
  animateTransitions: PropTypes.bool,

  /**
   * Custom Animation type. 'spring' or 'timing'.
   */
  animationType: PropTypes.oneOf(['spring', 'timing']),

  /**
   * Used to configure the animation parameters.  These are the same parameters in the Animated library.
   */
  animationConfig: PropTypes.object,
  containerStyle: ViewPropTypes.style,
};

Slider.defaultProps = {
  value: 0,
  minimumValue: 0,
  maximumValue: 1,
  step: 0,
  minimumTrackTintColor: colors.sliderLeft,
  maximumTrackTintColor: colors.sliderRight,
  thumbTintColor: colors.white,
  thumbTouchSize: {width: 40, height: 40},
  debugTouchArea: false,
  animationType: 'timing',
};

const styles = StyleSheet.create({
  sliderIconContainer: {
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  container: {
    height: 40,
    justifyContent: 'center',
    flexGrow: 1,
  },
  track: {
    height: TRACK_SIZE,
    borderRadius: TRACK_SIZE / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    top: 22
  },
  touchArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  thumbTopShadow: {
    position: 'absolute',
    top: 0,
    shadowOpacity: 1,
    shadowRadius: 1,
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: {width: 0, height: -1}
  },
  thumbBottomShadow: {
    position: 'absolute',
    top: 0,
    shadowOpacity: 1,
    shadowRadius: 1,
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: {width: 1, height: 2},
  },
  debugThumbTouchArea: {
    position: 'absolute',
    backgroundColor: 'green',
    opacity: 0.5,
  },
  disabled: {
    opacity: 0.4
  },
  phaseSliderContainer: {
    position: 'absolute',
    width: '100%'
  },
  phaseSliderItem: {
    width: 12,
    height: 12,
    borderRadius: 50
  }
});

const defaultItemStyles = StyleSheet.create({
  itemWrapper: {
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  item: {
    fontFamily: 'PingFangHK-Regular',
    color: 'rgba(62,74,89,0.7)',
  },
});

const defaultIconStyles = StyleSheet.create({
  iconLeft: {
    flexShrink: 1,
    marginTop: 6,
    marginRight: 5,
    color: colors.sliderLeft,
  },
  iconRight: {
    flexShrink: 1,
    marginTop: 6,
    marginLeft: 5,
    color: colors.sliderLeft,
  }
});