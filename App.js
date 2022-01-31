import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  Button,
  Image,
} from 'react-native';
import * as tf from '@tensorflow/tfjs';
const bodyPix = require('@tensorflow-models/body-pix');
import * as mobilenet from '@tensorflow-models/mobilenet'
import Canvas, {Image as CanvasImage, Path2D, ImageData} from 'react-native-canvas';
import * as ImagePicker from 'expo-image-picker';
import '@tensorflow/tfjs-react-native';
import Constants from 'expo-constants'
import * as Permissions from 'expo-permissions'
import {encode, decode} from 'base64-arraybuffer';
import * as jpeg from 'jpeg-js'

export class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isTfReady: false,
      imageOriginal: '',
      imageBase64: '',
      image: null
    };
  }

  getPermissionAsync = async () => {
    if (Constants.platform.ios) {
      const { status } = await Permissions.askAsync(Permissions.CAMERA_ROLL)
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!')
      }
    }
  }

  async componentDidMount() {
    // Wait for tf to be ready.
    await tf.ready();   
    // Signal to the app that tensorflow.js can now be used.
    this.setState({
      isTfReady: true,
    });

    //this.getPermissionAsync();
  }

  imageToTensor(rawImageData) {
    const TO_UINT8ARRAY = true
    const { width, height, data } = jpeg.decode(rawImageData, TO_UINT8ARRAY)
    // Drop the alpha channel info for mobilenet
    const buffer = new Uint8Array(width * height * 3)
    let offset = 0 // offset into original data
    for (let i = 0; i < buffer.length; i += 3) {
      buffer[i] = data[offset]
      buffer[i + 1] = data[offset + 1]
      buffer[i + 2] = data[offset + 2]

      offset += 4
    }

    return tf.tensor3d(buffer, [height, width, 3])
  }

  backgroundRemoval = async (canvas) => {
   
    const net = await bodyPix.load();    
    const rawImageData = decode(this.state.imageBase64);
    const imageTensor = this.imageToTensor(rawImageData);    
    const segmentation = await net.segmentPerson(imageTensor);    

    const ctx = canvas.getContext('2d');
    ctx.getImageData(0, 0, canvas.width, canvas.height).then(imageData => {
      ctx.createImageData(canvas.width, canvas.height).then(newImg => {
        const newImgData = newImg.data;
     
        segmentation.data.forEach((segment, i) => {
          if (segment == 1) {
            newImgData[i * 4] = imageData[i * 4]
            newImgData[i * 4 + 1] = imageData[i * 4 + 1]
            newImgData[i * 4 + 2] = imageData[i * 4 + 2]
            newImgData[i * 4 + 3] = imageData[i * 4 + 3]
          }
        })

        ctx.putImageData(newImg, 0, 0);
      });
    });
  }

  handleImageData = (canvas) => {
    const image = new CanvasImage(canvas);
    canvas.width = 300;
    canvas.height = 300;

    const context = canvas.getContext('2d');
    context.clearRect(0,0,canvas.width,canvas.height);
    image.src = `data:image/png;base64, ${this.state.imageBase64}`;
    image.addEventListener('load', () => {
      context.drawImage(image, 0, 0,canvas.width,canvas.height);
      this.backgroundRemoval(canvas);
    });    
  }


  render() {
    return (
    <View style={styles.container}>
      <Button
        title="Select"
         onPress={async () => {
          // No permissions request is necessary for launching the image library
          let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            base64: true,
            quality: 1,
          });
          
          if (!result.cancelled) {
            this.setState({
              imageOriginal: result.uri,
              imageBase64 : result.base64
            });    
          }
        }}
      />
      {this.state.imageOriginal != null && this.state.imageOriginal != '' && 
      <Image
        resizeMethod='auto'
        resizeMode='contain'
        style={styles.image}
        source={{
          uri: this.state.imageOriginal,
        }}
      />    
      }

      {this.state.imageBase64 != null && this.state.imageBase64 != '' && 
        <Canvas ref={this.handleImageData} />
      }
    </View>
   );
  }
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 300,
    height: 300,
  },
});

export default App;
