import React, { useState } from "react";
import { Image, StyleSheet, Dimensions, View, ScrollView, Text, TouchableOpacity } from "react-native";
import Swiper from "react-native-swiper";
import axios from "axios";
import baseURL from "../assets/common/baseurl";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

var { width } = Dimensions.get("window");

const Banner = () => {
  const navigation = useNavigation();
  const [bannerData, setBannerData] = useState([]);
  const [failedImages, setFailedImages] = useState({});

  const formatDiscount = (voucher) => {
    if ((voucher?.discountType || '').toLowerCase() === 'fixed') {
      return `SAVE PHP ${Number(voucher?.discountValue || 0).toFixed(0)}`;
    }
    return `${Number(voucher?.discountValue || 0).toFixed(0)}% OFF`;
  };

  const toBannerItem = (voucher) => ({
    id: voucher?.id,
    promoCode: voucher?.promoCode || '',
    title: voucher?.title || '',
    message: voucher?.message || '',
    discountType: voucher?.discountType || 'percent',
    discountValue: voucher?.discountValue || 0,
    minOrderAmount: voucher?.minOrderAmount || 0,
    expiresAt: voucher?.expiresAt || null,
    image: voucher?.imageUrl || '',
    subtitle: String(voucher?.title || voucher?.promoCode || 'LIMITED PROMO').toUpperCase(),
    discount: formatDiscount(voucher),
  });

  const extractVoucherList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.vouchers)) return payload.vouchers;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  };

  const fetchActiveVouchers = async () => {
    try {
      // Fetch both active and all vouchers to show new promotions
      let vouchers = [];
      try {
        const res = await axios.get(`${baseURL}vouchers/public/active`);
        vouchers = extractVoucherList(res?.data);
      } catch (err) {
        console.log('[Banner] Could not fetch public active vouchers, trying public endpoint');
        try {
          const res = await axios.get(`${baseURL}vouchers/public`);
          vouchers = extractVoucherList(res?.data);
        } catch (_err) {
          vouchers = [];
        }
      }
      const prepared = vouchers
        .filter((voucher) => !!voucher?.id)
        .slice(0, 5)
        .map(toBannerItem);
      setBannerData(prepared);
      setFailedImages({});
    } catch {
      setBannerData([]);
      setFailedImages({});
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchActiveVouchers();
      return undefined;
    }, [])
  );

  return (
    <View style={styles.container}>
      {bannerData.length === 0 ? (
        <View style={styles.emptyBanner}>
          <Text style={styles.emptyTitle}>No active promos available</Text>
          <Text style={styles.emptySub}>New voucher broadcasts will appear here.</Text>
        </View>
      ) : (
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
              <TouchableOpacity
                key={item.id || index}
                style={styles.bannerSlide}
                activeOpacity={0.92}
                onPress={() => {
                  if (!item.id) return;
                  navigation.navigate('Voucher Detail', {
                    voucherId: item.id,
                    voucher: item,
                  });
                }}
              >
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
              </TouchableOpacity>
            );
          })}
        </Swiper>
        <View style={{ height: 10 }}></View>
      </View>
      )}
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
  emptyBanner: {
    width: width - 20,
    marginHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E8EC',
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  emptyTitle: {
    color: '#2F3440',
    fontWeight: '700',
    fontSize: 15,
  },
  emptySub: {
    marginTop: 4,
    color: '#7A8392',
    fontSize: 13,
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