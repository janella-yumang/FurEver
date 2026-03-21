import React from 'react';
import { TextInput, StyleSheet } from 'react-native'

const Input = (props) => {
    return (
        <TextInput
            style={styles.input}
            placeholder={props.placeholder}
            placeholderTextColor={props.placeholderTextColor || '#6B7280'}
            name={props.name}
            id={props.id}
            value={props.value}
            autoCorrect={props.autoCorrect}
            autoCapitalize={props.autoCapitalize}
            onChangeText={props.onChangeText}
            onFocus={props.onFocus}
            secureTextEntry={props.secureTextEntry}
            keyboardType={props.keyboardType}
            autoComplete={props.autoComplete}
            textContentType={props.textContentType}
        >
        </TextInput>
    );
}

const styles = StyleSheet.create({
    input: {
        width: '80%',
        height: 60,
        backgroundColor: 'white',
        color: '#111827',
        margin: 10,
        borderRadius: 20,
        padding: 10,
        borderWidth: 2,
        fontSize: 16,
        borderColor: '#FF8C42'
    },
});

export default Input;