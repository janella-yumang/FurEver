# 📱 Barcode Scanner Feature

This app now includes a fully-featured barcode and QR code scanner built with Expo Camera.

## 🎯 Features

- ✅ **Multiple Barcode Formats**: QR Code, EAN-13, EAN-8, Code 128, Code 39, UPC-A, UPC-E, PDF417, Aztec, and more
- ✅ **Flash/Torch Support**: Toggle flash for low-light scanning
- ✅ **Visual Feedback**: Animated scan frame and corner highlights
- ✅ **Permission Handling**: Graceful camera permission requests
- ✅ **Platform Support**: Works on iOS and Android (web shows appropriate message)
- ✅ **Scan History**: Keeps track of all scanned codes
- ✅ **Easy Integration**: Reusable component with callback support

## 🚀 Quick Start

### Access the Scanner

1. **Via User Profile Menu**:
   - Login to your account
   - Go to User Profile
   - Tap "Barcode Scanner"

2. **Programmatically**:
   ```javascript
   navigation.navigate('Scanner');
   ```

## 💻 How to Use in Your Code

### Basic Usage

```javascript
import React, { useState } from 'react';
import { Modal } from 'react-native';
import BarcodeScanner from '../Shared/BarcodeScanner';

function MyComponent() {
  const [showScanner, setShowScanner] = useState(false);

  const handleScan = ({ type, data }) => {
    console.log('Scanned:', type, data);
    setShowScanner(false);
    // Do something with the scanned data
  };

  return (
    <>
      <Button title="Scan" onPress={() => setShowScanner(true)} />
      
      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner 
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    </>
  );
}
```

### With Custom Title

```javascript
<BarcodeScanner 
  title="🔍 Scan Product Barcode"
  onScan={handleScan}
  onClose={handleClose}
/>
```

### Product Search Integration

```javascript
const handleProductScan = async ({ type, data }) => {
  setShowScanner(false);
  
  // Search for product by barcode
  const product = await searchProductByBarcode(data);
  
  if (product) {
    navigation.navigate('SingleProduct', { product });
  } else {
    Alert.alert('Not Found', 'Product not found in our database');
  }
};
```

### Add to Cart by Scanning

```javascript
const handleQuickAdd = async ({ type, data }) => {
  setShowScanner(false);
  
  const product = await fetchProductByBarcode(data);
  
  if (product) {
    dispatch(addToCart(product));
    Toast.show({
      type: 'success',
      text1: 'Added to Cart',
      text2: product.name
    });
  }
};
```

## 📦 Component Props

### BarcodeScanner

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onScan` | `(data: {type: string, data: string}) => void` | No | - | Callback when code is scanned |
| `onClose` | `() => void` | Yes | - | Callback to close scanner |
| `title` | `string` | No | "📦 Scan Barcode/QR Code" | Scanner screen title |

## 🎨 Supported Barcode Formats

- **QR Code** - Quick Response codes
- **EAN-13** - European Article Number (retail products)
- **EAN-8** - 8-digit EAN (smaller products)
- **Code 128** - High-density barcode
- **Code 39** - Alphanumeric barcode
- **Code 93** - Compact barcode
- **UPC-A** - Universal Product Code (US/Canada)
- **UPC-E** - Compressed UPC
- **ITF-14** - Interleaved 2 of 5
- **PDF417** - 2D stacked barcode
- **Aztec** - 2D matrix barcode
- **Data Matrix** - 2D matrix code

## 🛠️ Use Cases

### 1. Product Lookup
Scan product barcodes to quickly find items in your database.

### 2. Quick Add to Cart
Scan and instantly add items to shopping cart (retail apps).

### 3. Inventory Management
Track inventory by scanning product codes.

### 4. Ticket/Pass Scanning
Validate QR codes for tickets, vouchers, or event passes.

### 5. User Authentication
Scan QR codes for quick login or account linking.

### 6. Price Checking
Scan barcodes to display current pricing.

### 7. Returns Processing
Scan order/receipt codes for returns and exchanges.

## 📱 Platform Notes

### Mobile (iOS/Android)
- Full camera access
- Flash/torch support
- All barcode formats supported
- Optimal performance

### Web
- Camera not supported
- Shows informative message
- Recommend using mobile app

## 🔒 Permissions

The scanner automatically requests camera permission on first use. Users will see:

1. Permission request dialog
2. If denied: Instructions to enable in settings
3. If granted: Camera view with scan frame

## 🎯 Tips for Best Results

1. **Good Lighting**: Use flash in dark environments
2. **Steady Hand**: Keep camera stable while scanning
3. **Distance**: Hold camera 6-12 inches from code
4. **Alignment**: Center code within the scan frame
5. **Clean Codes**: Ensure barcodes aren't damaged or dirty

## 🐛 Troubleshooting

### Camera not showing
- Check camera permissions in device settings
- Restart the app
- Verify expo-camera is installed: `npx expo install expo-camera`

### Scan not detecting
- Improve lighting conditions
- Move camera closer/farther
- Try enabling flash
- Ensure barcode is not damaged

### Works on Android but not iOS
- Ensure Xcode and iOS Simulator are updated
- Check Info.plist has camera permission description
- Try on physical device

## 📚 Example Files

- **Scanner Component**: `Shared/BarcodeScanner.js`
- **Demo Screen**: `Screens/User/ScannerDemo.js`
- **Integration Example**: `Shared/ScannerIntegrationExample.js`

## 🎓 Learn More

- [Expo Camera Documentation](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Barcode Types Reference](https://docs.expo.dev/versions/latest/sdk/bar-code-scanner/#supported-formats)

---

**Built with ❤️ using Expo Camera**
