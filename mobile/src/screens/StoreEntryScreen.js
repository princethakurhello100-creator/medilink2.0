import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { StoreAuthProvider } from "../context/StoreAuthContext";
import StoreNavigator from "../navigation/StoreNavigator";

// This screen mounts the entire store admin sub-app
export default function StoreEntryScreen() {
  return (
    <StoreAuthProvider>
      <StoreNavigator />
    </StoreAuthProvider>
  );
}