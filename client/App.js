import React, { useEffect, useState } from 'react';
import { View, Text, Button, TextInput, StyleSheet } from 'react-native';
import Counter from './components/Counter';
import { add } from './utils/math';
import { isEmailValid } from './utils/validation';
import useCounter from './hooks/useCounter';

export default function App() {
  const [email, setEmail] = useState('');
  const [apiName, setApiName] = useState('');
  const { count, increment } = useCounter();

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/users/1');
      const data = await response.json();
      setApiName(data.name);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expo Jest Testing Demo</Text>

      {/* 1. Utility Function */}
      <Text>5 + 3 = {add(5, 3)}</Text>

      {/* 2. Input Validation */}
      <TextInput
        placeholder="Enter Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <Text>
        Email Valid: {email ? isEmailValid(email).toString() : 'Enter email'}
      </Text>

      {/* 3 + 4. Counter Component */}
      <Counter />

      {/* 5. API Mock */}
      <Text>API User: {apiName}</Text>

      {/* 6. Custom Hook */}
      <Text>Hook Count: {count}</Text>
      <Button title="Increment Hook Count" onPress={increment} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    marginTop: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    marginVertical: 10,
    padding: 10,
  },
});
