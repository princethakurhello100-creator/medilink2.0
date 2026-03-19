import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useStoreAuth } from "../context/StoreAuthContext";
import { ActivityIndicator, View } from "react-native";
import StoreLoginScreen    from "../screens/StoreLoginScreen";
import StoreRegisterScreen from "../screens/StoreRegisterScreen";
import StoreDashboardScreen from "../screens/StoreDashboardScreen";

const Stack = createStackNavigator();

export default function StoreNavigator() {
  const { storeAdmin, storeLoading } = useStoreAuth();

  if (storeLoading) return (
    <View style={{ flex:1, justifyContent:"center", alignItems:"center" }}>
      <ActivityIndicator size="large" color="#1B4F8A" />
    </View>
  );

  return (
    <Stack.Navigator screenOptions={{
      headerStyle: { backgroundColor: "#1B4F8A" },
      headerTintColor: "#fff",
      headerTitleStyle: { fontWeight: "bold" },
    }}>
      {storeAdmin ? (
        <Stack.Screen name="StoreDashboard" component={StoreDashboardScreen}
          options={{ title: "Store Dashboard", headerLeft: () => null }} />
      ) : (
        <>
          <Stack.Screen name="StoreLogin"    component={StoreLoginScreen}    options={{ title: "Store Admin Login", headerShown: false }} />
          <Stack.Screen name="StoreRegister" component={StoreRegisterScreen} options={{ title: "Register Pharmacy" }} />
        </>
      )}
    </Stack.Navigator>
  );
}