import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BarcodeScanner from '../../Shared/BarcodeScanner';

/**
 * Example component showing how to integrate BarcodeScanner into your app
 * 
 * Usage:
 * 
 * 1. Basic usage - just scan and get data:
 *    <BarcodeScanner 
 *      onScan={({type, data}) => console.log(data)}
 *      onClose={() => setShowScanner(false)}
 *    />
 * 
 * 2. Custom title:
 *    <BarcodeScanner 
 *      title="🔍 Scan Product Barcode"
 *      onScan={handleScan}
 *      onClose={handleClose}
 *    />
 * 
 * 3. In a Modal (recommended):
 *    <Modal visible={showScanner} animationType="slide">
 *      <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
 *    </Modal>
 */

const ScannerIntegrationExample = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const handleScan = ({ type, data }) => {
    // Do something with the scanned data
    setScannedData({ type, data });
    setShowScanner(false);
    
    // Example: Search for product by barcode
    // searchProductByBarcode(data);
    
    // Example: Navigate to product details
    // navigation.navigate('SingleProduct', { barcode: data });
    
    // Example: Add to cart
    // addToCartByBarcode(data);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Barcode Scanner Integration</Text>
      
      <TouchableOpacity 
        style={styles.scanButton}
        onPress={() => setShowScanner(true)}
      >
        <Ionicons name="scan" size={24} color="#fff" />
        <Text style={styles.scanButtonText}>Open Scanner</Text>
      </TouchableOpacity>

      {scannedData && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Last Scan:</Text>
          <Text style={styles.resultType}>Type: {scannedData.type}</Text>
          <Text style={styles.resultData}>Data: {scannedData.data}</Text>
        </View>
      )}

      <Modal 
        visible={showScanner} 
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <BarcodeScanner 
          title="🔍 Scan Product Barcode"
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
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C42',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  resultType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resultData: {
    fontSize: 14,
    color: '#333',
  },
});

export default ScannerIntegrationExample;
