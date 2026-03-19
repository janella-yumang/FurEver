import React from 'react';
import { View, StyleSheet, Dimensions, } from 'react-native'

import { FlatList, TouchableOpacity } from 'react-native';
import { Surface, Text, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
var { width } = Dimensions.get("window")

const FALLBACK_IMAGE = 'https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png';

const resolveImageUri = (image) => {
    if (typeof image === 'string') {
        const trimmed = image.trim();
        return trimmed.length ? trimmed : FALLBACK_IMAGE;
    }
    if (image && typeof image === 'object' && typeof image.uri === 'string' && image.uri.trim().length) {
        return image.uri.trim();
    }
    return FALLBACK_IMAGE;
};

const SearchedProduct = ({ productsFiltered }) => {
    const navigation = useNavigation();
    return (

        <View style={{ width: width, backgroundColor: '#F8FAFC', minHeight: 180 }}>
            {productsFiltered.length > 0 ? (

                <Surface style={styles.resultsSurface}>
                    <FlatList
                        data={productsFiltered}
                        renderItem={({ item }) =>
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => navigation.navigate("Product Detail", { item })}
                            >
                                <Surface style={styles.resultContent}>
                                    <Avatar.Image size={24}
                                        source={{
                                            uri: resolveImageUri(item.image)
                                        }} />
                                    <Text variant="labelMedium" numberOfLines={1} ellipsizeMode="tail" style={styles.productName}>
                                        {item.name}
                                    </Text>
                                </Surface>

                            </TouchableOpacity>}

                        keyExtractor={item => item._id} />
                </Surface >
            ) : (
                <View style={styles.center}>
                    <Text style={{ alignSelf: 'center' }}>
                        No products match the selected criteria
                    </Text>
                </View>
            )}
        </View >

    );
};


const styles = StyleSheet.create({
    center: {
        justifyContent: 'center',
        alignItems: 'center',
        height: 100
    },
    listContainer: {
        // height: height,
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-start",
        flexWrap: "wrap",
        backgroundColor: "gainsboro",
    },
    resultItem: {
        width: '100%',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    resultContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
    },
    resultsSurface: {
        backgroundColor: '#F8FAFC',
        paddingTop: 8,
    },
    productName: {
        marginLeft: 10,
        flex: 1,
    },
})

export default SearchedProduct;