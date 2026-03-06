import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarcodeScanner from '../../Shared/BarcodeScanner';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import baseURL from '../../assets/common/baseurl';

const ScannerDemo = ({ navigation }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);

  const handleScan = async ({ type, data }) => {
    // Add to history
    const newScan = {
      id: Date.now().toString(),
      type,
      data,
      timestamp: new Date().toLocaleString(),
    };
    
    setScanHistory([newScan, ...scanHistory]);
    setShowScanner(false);

    // Try to look up the product by barcode
    try {
      const res = await axios.get(`${baseURL}products/barcode/${encodeURIComponent(data)}`);
      if (res.data) {
        Toast.show({
          topOffset: 60,
          type: 'success',
          text1: 'Product Found!',
          text2: res.data.name,
        });
        // Navigate to SingleProduct screen
        navigation.navigate('Home', {
          screen: 'SingleProduct',
          params: { item: res.data },
        });
        return;
      }
    } catch (err) {
      // Not found or error — just show generic scanned toast
    }

    Toast.show({
      topOffset: 60,
      type: 'info',
      text1: 'Code Scanned',
      text2: data,
    });
  };

  const clearHistory = () => {
    setScanHistory([]);
    Toast.show({
      topOffset: 60,
      type: 'success',
      text1: 'History Cleared',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Barcode Scanner</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Scan Button */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="scan" size={48} color="#fff" />
          <Text style={styles.scanButtonText}>Tap to Scan</Text>
          <Text style={styles.scanButtonSubtext}>
            QR Code, Barcode, and more
          </Text>
        </TouchableOpacity>

        {/* Supported Formats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📱 Supported Formats</Text>
          <View style={styles.formatGrid}>
            {[
              'QR Code',
              'EAN-13',
              'EAN-8',
              'Code 128',
              'Code 39',
              'Code 93',
              'UPC-A',
              'UPC-E',
              'ITF-14',
              'PDF417',
              'Aztec',
              'Data Matrix',
            ].map((format, index) => (
              <View key={index} style={styles.formatChip}>
                <Text style={styles.formatText}>{format}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Scan History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Scan History</Text>
            {scanHistory.length > 0 && (
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {scanHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No scans yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the button above to start scanning
              </Text>
            </View>
          ) : (
            scanHistory.map((scan) => (
              <View key={scan.id} style={styles.historyCard}>
                <View style={styles.historyIcon}>
                  <Ionicons name="qr-code" size={24} color="#FF8C42" />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyType}>{scan.type}</Text>
                  <Text style={styles.historyData} numberOfLines={2}>
                    {scan.data}
                  </Text>
                  <Text style={styles.historyTime}>{scan.timestamp}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Usage Examples */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Use Cases</Text>
          {[
            {
              icon: 'cart',
              title: 'Product Lookup',
              desc: 'Scan product barcodes to quickly add items to cart',
            },
            {
              icon: 'pricetag',
              title: 'Price Check',
              desc: 'Verify pricing and product information',
            },
            {
              icon: 'gift',
              title: 'Promotions',
              desc: 'Scan QR codes for special offers and discounts',
            },
            {
              icon: 'swap-horizontal',
              title: 'Returns',
              desc: 'Scan receipts and order codes for easy returns',
            },
          ].map((item, index) => (
            <View key={index} style={styles.useCaseCard}>
              <View style={styles.useCaseIcon}>
                <Ionicons name={item.icon} size={24} color="#FF8C42" />
              </View>
              <View style={styles.useCaseContent}>
                <Text style={styles.useCaseTitle}>{item.title}</Text>
                <Text style={styles.useCaseDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  scanButton: {
    margin: 20,
    backgroundColor: '#FF8C42',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  scanButtonSubtext: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  clearText: {
    color: '#FF8C42',
    fontSize: 14,
    fontWeight: '600',
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  formatText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
    textAlign: 'center',
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyType: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  historyData: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyTime: {
    fontSize: 11,
    color: '#999',
  },
  useCaseCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  useCaseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  useCaseContent: {
    flex: 1,
  },
  useCaseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  useCaseDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});

export default ScannerDemo;
