/**
 * Animated Side Drawer Pattern
 * 
 * Demonstrates a custom animated slide-out drawer for React Native,
 * using the Animated API with translateX for smooth open/close transitions
 * and a semi-transparent overlay for dismissal.
 * 
 * Technique: Animated.timing on translateX + opacity overlay
 * Pattern: Reusable drawer with configurable width and animation duration
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = 280;
const ANIMATION_DURATION = 300;

const AnimatedDrawer = ({ menuItems = [], onItemPress }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Animated values for drawer slide and overlay fade
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  /**
   * Open the drawer with a parallel animation:
   * - Drawer slides in from the left (translateX: -280 → 0)
   * - Overlay fades in (opacity: 0 → 0.5)
   */
  const openDrawer = () => {
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0.5,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start();
  };

  /**
   * Close the drawer with the reverse animation.
   * The isOpen state is set to false in the callback to unmount
   * the overlay only after the animation completes.
   */
  const closeDrawer = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => setIsOpen(false));
  };

  const handleItemPress = (item) => {
    closeDrawer();
    if (onItemPress) onItemPress(item);
  };

  return (
    <View style={styles.container}>
      {/* Header bar with menu toggle */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Title</Text>
      </View>

      {/* Overlay — tapping dismisses the drawer */}
      {isOpen && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <Animated.View
            style={[styles.overlay, { opacity: overlayOpacity }]}
          />
        </TouchableWithoutFeedback>
      )}

      {/* Drawer panel — slides in from left */}
      <Animated.View
        style={[styles.drawer, { transform: [{ translateX }] }]}
      >
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Menu</Text>
        </View>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.drawerItem}
            onPress={() => handleItemPress(item)}
          >
            <Text style={styles.drawerItemText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e',
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#16213e',
    zIndex: 20,
    paddingTop: 60,
    elevation: 16, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  drawerItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  drawerItemText: {
    fontSize: 16,
    color: '#e0e0e0',
  },
});

export default AnimatedDrawer;

/**
 * Usage example:
 *
 * const menuItems = [
 *   { label: 'Home', screen: 'Home' },
 *   { label: 'Profile', screen: 'Profile' },
 *   { label: 'Settings', screen: 'Settings' },
 * ];
 *
 * <AnimatedDrawer
 *   menuItems={menuItems}
 *   onItemPress={(item) => navigation.navigate(item.screen)}
 * />
 */
