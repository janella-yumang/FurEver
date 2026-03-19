import React, { useState, useEffect } from "react";
import { Image, StyleSheet, Dimensions, View, ScrollView, Text } from "react-native";
import Swiper from "react-native-swiper";

var { width } = Dimensions.get("window");

const Banner = () => {
  const [bannerData, setBannerData] = useState([]);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    setBannerData([
      {
        image: "https://images.unsplash.com/photo-1560807707-ace0c72e4a30?w=800&q=80",
        title: "Best Deal Online",
        subtitle: "PREMIUM PET PRODUCTS",
        discount: "UP to 50% OFF"
      },
      {
        image: "https://images.unsplash.com/photo-1514888286974-6c03bf1bbb15?w=800&q=80",
        title: "Premium Quality",
        subtitle: "PET SUPPLIES",
        discount: "UP to 40% OFF"
      },
      {
        image: "https://images.unsplash.com/photo-1520763185298-1b434c919eba?w=800&q=80",
        title: "Expert Recommendations",
        subtitle: "SELECTED ITEMS",
        discount: "UP to 60% OFF"
      },
    ]);

    return () => {
      setBannerData([]);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.swiper}>
        <Swiper
          style={{ height: width / 2 }}
          showButtons={false}
          autoplay={true}
          autoplayTimeout={3}
          paginationStyle={styles.pagination}
          activeDotStyle={styles.activeDot}
          dotStyle={styles.dot}
        >
          {bannerData.map((item, index) => {
            const hasImageError = !!failedImages[index];
            return (
              <View key={index} style={styles.bannerSlide}>
                {hasImageError ? (
                  <View style={[styles.imageBanner, styles.imageFallback]} />
                ) : (
                  <Image
                    style={styles.imageBanner}
                    resizeMode="cover"
                    source={{ uri: item.image }}
                    onError={() => setFailedImages((prev) => ({ ...prev, [index]: true }))}
                  />
                )}
                <View style={styles.overlay}>
                  <Text style={styles.discountText}>{item.discount}</Text>
                  <Text style={styles.titleText}>{item.subtitle}</Text>
                </View>
              </View>
            );
          })}
        </Swiper>
        <View style={{ height: 10 }}></View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f5f5",
    paddingVertical: 10,
  },
  swiper: {
    width: width,
    alignItems: "center",
  },
  bannerSlide: {
    position: 'relative',
    width: '100%',
    height: width / 2,
  },
  imageBanner: {
    height: width / 2,
    width: width - 20,
    borderRadius: 12,
    marginHorizontal: 10,
  },
  imageFallback: {
    backgroundColor: '#FFD7BD',
  },
  overlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: 15,
  },
  discountText: {
    color: '#FF6B6B',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  titleText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pagination: {
    bottom: -40,
  },
  dot: {
    backgroundColor: '#ccc',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FF6B6B',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  }
});

export default Banner;