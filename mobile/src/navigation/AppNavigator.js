import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import LoginScreen      from "../screens/LoginScreen";
import RegisterScreen   from "../screens/RegisterScreen";
import HomeScreen       from "../screens/HomeScreen";
import SearchScreen     from "../screens/SearchScreen";
import StoreEntryScreen from "../screens/StoreEntryScreen";
import ChatScreen from '../screens/ChatScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return (
    <View style={{ flex:1, justifyContent:"center", alignItems:"center" }}>
      <ActivityIndicator size="large" color="#1B4F8A" />
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{
        headerStyle: { backgroundColor: "#1B4F8A" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold" },
      }}>
        {user ? (
          <>
            <Stack.Screen name="Home"   component={HomeScreen}   options={{ title: "MediLink 2.0", headerLeft: () => null }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: "Medicine Search" }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login"      component={LoginScreen}      options={{ headerShown: false }} />
            <Stack.Screen name="Register"   component={RegisterScreen}   options={{ title: "Create Account" }} />
            <Stack.Screen name="StoreEntry" component={StoreEntryScreen} options={{ title: "Store Admin" }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}