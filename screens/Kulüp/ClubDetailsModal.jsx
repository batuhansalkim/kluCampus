import React from 'react';
import { View, Text, Image, StyleSheet, FlatList, Linking, Modal, TouchableOpacity } from 'react-native';

const ClubDetailsModal = ({ visible, club, onClose }) => {
  if (!club) return null;

  const renderSocialMedia = ({ item }) => (
    <Text style={styles.link} onPress={() => Linking.openURL(item.link)}>
      {item.platform}
    </Text>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
          <Image source={{ uri: club.image }} style={styles.image} />
          <Text style={styles.name}>{club.name}</Text>
          <Text style={styles.detail}>Başkan: {club.president}</Text>
          <Text style={styles.detail}>Danışman: {club.advisor}</Text>
          <Text style={styles.header}>Sosyal Medya:</Text>
          <FlatList
            data={club.socialMedia}
            renderItem={renderSocialMedia}
            keyExtractor={(item) => item.platform}
            numColumns={2} // 2 sütun yapar
            columnWrapperStyle={styles.row} // Satırları düzgün hizalamak için
/>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Daha soft arka plan rengi
  },
  modalContent: {
    width: '85%', // Genişlik artırıldı
    backgroundColor: '#ffffff', // Arka plan rengi
    borderRadius: 15, // Daha yuvarlak kenarlar
    padding: 25, // Daha fazla padding
    alignItems: 'center',
    elevation: 10, // Gölgelendirme
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  closeButtonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ff0000', // Kırmızı renk
  },
  image: {
    width: 220, // Genişlik artırıldı
    height: 220, // Yükseklik artırıldı
    borderRadius: 110, // Daire biçimi
    marginBottom: 15,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333', // Daha koyu renk
  },
  detail: {
    fontSize: 18,
    marginBottom: 5,
    color: '#555', // Daha açık gri
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  link: {
    fontSize: 18,
    color: '#007bff', // Daha dikkat çekici mavi

    marginVertical: 5,
    paddingVertical: 5, // Bağlantılar arasında mesafe
    paddingHorizontal: 10, // Yan kenar boşlukları
    borderRadius: 5, // Yuvarlatılmış kenarlar
    backgroundColor: '#e7f1ff', // Arka plan rengi
  },
  row: {
    width:"100%",
  justifyContent: 'space-around', // Öğeler arasında daha fazla boşluk
  marginVertical: 10,
  marginHorizontal: 10, // Kenarlardan boşluk
},
});

export default ClubDetailsModal;
