import React, { useState, useRef, useEffect } from 'react';
import { View, FlatList, Text, TextInput, StyleSheet, TouchableOpacity, Image, Animated, Dimensions, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { collection, addDoc, getDocs, query, orderBy, updateDoc, doc, deleteDoc, getDoc, increment, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { FIRESTORE_DB } from '../../FirebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MessageScreen() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(null);

  const scrollViewRef = useRef(null);

  // Kullanıcı bilgisini al
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        const userDataStr = await AsyncStorage.getItem('userData');
        console.log('Stored userId:', userId);
        console.log('Stored userData:', userDataStr);

        if (userId && userDataStr) {
          const userData = JSON.parse(userDataStr);
          setCurrentUser(userData);
          console.log('Current user set:', userData);
        } else {
          console.log('No user data found in AsyncStorage');
        }
      } catch (error) {
        console.error('Kullanıcı bilgisi alınırken hata:', error);
      }
    };

    getCurrentUser();
  }, []);

  // Mesajları getir
  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const messagesRef = collection(FIRESTORE_DB, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const messagesData = [];
      for (const doc of querySnapshot.docs) {
        const messageData = { id: doc.id, ...doc.data() };
        
        // Her mesaj için scale değeri ekle
        messageData.scale = new Animated.Value(1);
        
        // Mesajın beğenilip beğenilmediğini kontrol et
        messageData.isLiked = currentUser ? messageData.likedBy?.includes(currentUser.id) : false;
        
        // Yorumları getir
        const commentsRef = collection(FIRESTORE_DB, `messages/${doc.id}/comments`);
        const commentsQuery = query(commentsRef, orderBy('createdAt', 'desc'));
        const commentsSnapshot = await getDocs(commentsQuery);
        
        messageData.commentList = commentsSnapshot.docs.map(commentDoc => {
          const commentData = { id: commentDoc.id, ...commentDoc.data() };
          // Yorumun beğenilip beğenilmediğini kontrol et
          commentData.isLiked = currentUser ? commentData.likedBy?.includes(currentUser.id) : false;
          return commentData;
        });
        
        // Yorum sayısını güncelle
        messageData.comments = messageData.commentList.length;
        
        messagesData.push(messageData);
      }
      
      setMessages(messagesData);
    } catch (error) {
      console.error('Mesajlar alınırken hata:', error);
      Alert.alert('Hata', 'Mesajlar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const userDataStr = await AsyncStorage.getItem('userData');
      
      if (!userId || !userDataStr) {
        Alert.alert('Uyarı', 'Mesaj göndermek için giriş yapmalısınız.');
        return;
      }

      const userData = JSON.parse(userDataStr);

      if (!newMessage.trim()) {
        return;
      }

      const messageData = {
        userId: userId,
        userName: userData.fullName,
        text: newMessage.trim(),
        likes: 0,
        likedBy: [],
        commentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const messageRef = await addDoc(collection(FIRESTORE_DB, 'messages'), messageData);

      setNewMessage('');
      fetchMessages();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Mesaj gönderilirken hata:', error);
      Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleAddComment = async () => {
    if (!currentUser) {
      Alert.alert('Uyarı', 'Yorum yapmak için giriş yapmalısınız.');
      return;
    }

    if (newComment.trim() && selectedMessage) {
      try {
        const commentRef = await addDoc(
          collection(FIRESTORE_DB, `messages/${selectedMessage.id}/comments`),
          {
            userId: currentUser.id,
            userName: currentUser.fullName,
            text: newComment.trim(),
        likes: 0,
            likedBy: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        );

        // Ana mesajın yorum sayısını güncelle
        await updateDoc(doc(FIRESTORE_DB, 'messages', selectedMessage.id), {
          commentCount: increment(1)
        });

        setNewComment('');
        fetchMessages(); // Mesajları yenile
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('Yorum eklenirken hata:', error);
        Alert.alert('Hata', 'Yorum eklenemedi.');
      }
    }
  };

  const handleLikeMessage = async (message) => {
    if (!currentUser) {
      Alert.alert('Uyarı', 'Beğenmek için giriş yapmalısınız.');
      return;
    }

    try {
      const messageRef = doc(FIRESTORE_DB, 'messages', message.id);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const likedBy = messageDoc.data().likedBy || [];
        const isLiked = likedBy.includes(currentUser.id);
        
        await updateDoc(messageRef, {
          likes: isLiked ? increment(-1) : increment(1),
          likedBy: isLiked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
        });
        
        fetchMessages(); // Mesajları yenile
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Beğeni işlemi sırasında hata:', error);
      Alert.alert('Hata', 'Beğeni işlemi gerçekleştirilemedi.');
    }
  };

  const handleLikeComment = async (messageId, commentId) => {
    if (!currentUser) {
      Alert.alert('Uyarı', 'Beğenmek için giriş yapmalısınız.');
      return;
    }

    try {
      const commentRef = doc(FIRESTORE_DB, `messages/${messageId}/comments`, commentId);
      const commentDoc = await getDoc(commentRef);
      
      if (commentDoc.exists()) {
        const likedBy = commentDoc.data().likedBy || [];
        const isLiked = likedBy.includes(currentUser.id);
        
        await updateDoc(commentRef, {
          likes: isLiked ? increment(-1) : increment(1),
          likedBy: isLiked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id)
        });
        
        fetchMessages(); // Mesajları yenile
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Yorum beğeni işlemi sırasında hata:', error);
      Alert.alert('Hata', 'Beğeni işlemi gerçekleştirilemedi.');
    }
  };

  const handleDeleteMessage = async () => {
    if (!currentUser || !currentMessage || currentMessage.userId !== currentUser.id) {
      Alert.alert('Uyarı', 'Bu mesajı silme yetkiniz yok.');
      return;
    }

    try {
      // Önce mesajın tüm yorumlarını sil
      const commentsRef = collection(FIRESTORE_DB, `messages/${currentMessage.id}/comments`);
      const commentsSnapshot = await getDocs(commentsRef);
      const batch = writeBatch(FIRESTORE_DB);
      
      commentsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Sonra mesajı sil
      batch.delete(doc(FIRESTORE_DB, 'messages', currentMessage.id));
      await batch.commit();

      setMessages(messages.filter(msg => msg.id !== currentMessage.id));
      setShowOptions(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Mesaj silinirken hata:', error);
      Alert.alert('Hata', 'Mesaj silinemedi.');
    }
  };

  const openComments = (message) => {
    setSelectedMessage(message);
    setShowComments(true);
    Haptics.selectionAsync();
  };

  const handleMoreOptions = (message) => {
    console.log('Options menu opened for:', message.text); // Hangi mesaj için açıldığını kontrol edin
    setCurrentMessage(message);
    setShowOptions(true);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => openComments(item)}>
      <BlurView intensity={80} tint="dark" style={styles.messageContainer}>
        <View style={styles.messageContent}>
          <View style={styles.headerRow}>
            <Text style={styles.username}>{item.userName}</Text>
            <Text style={styles.timestamp}>
              {item.createdAt?.toDate().toLocaleString('tr-TR')}
            </Text>
          </View>
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => handleLikeMessage(item)} style={styles.actionButton}>
              <Animated.View style={{ transform: [{ scale: item.scale }] }}>
                <Animated.Text style={[styles.actionText, item.isLiked ? styles.liked : null]}>
                  {item.isLiked ? '❤️' : '🤍'} {item.likes}
                </Animated.Text>
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => openComments(item)} style={styles.actionButton}>
              <Text style={styles.actionText}>💬 {item.comments}</Text>
            </TouchableOpacity>

            {currentUser && currentUser.id === item.userId && (
              <TouchableOpacity onPress={() => handleMoreOptions(item)} style={styles.moreOptionsButton}>
                <Ionicons name="menu" size={24} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );

  const renderOptionsModal = () => (
    <Modal
      transparent={true}
      animationType="fade"
      visible={showOptions}
      onRequestClose={() => setShowOptions(false)}
    >
      <View style={styles.modalContainer}>
        <BlurView intensity={100} tint="dark" style={styles.modalContent}>
          {/* <TouchableOpacity onPress={handleEditMessage} style={styles.optionButton}>
            <Text style={styles.optionText}>Düzenle</Text>
          </TouchableOpacity> */}
          <TouchableOpacity onPress={handleDeleteMessage} style={styles.optionButton}>
            <Text style={styles.optionText}>Sil</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowOptions(false)} style={styles.optionButton}>
            <Text style={styles.optionText}>Kapat</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </Modal>
  );
  
  const renderCommentItem = ({ item }) => (
    <BlurView intensity={80} tint="dark" style={styles.commentContainer}>
      {/* <Image source={{ uri: item.profileImage }} style={styles.commentProfileImage} /> */}
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{item.user}</Text>
          <Text style={styles.commentTimestamp}>{item.timestamp}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
        <TouchableOpacity 
          style={styles.commentLikeButton} 
          onPress={() => handleLikeComment(selectedMessage.id, item.id)}
        >
          <Text style={[styles.commentLikeText, item.isLiked ? styles.commentLiked : null]}>
            {item.isLiked ? '❤️' : '🤍'} {item.likes}
          </Text>
        </TouchableOpacity>
      </View>
    </BlurView>
  );

  const renderComments = () => (
    <LinearGradient
      colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <BlurView intensity={100} tint="dark" style={styles.commentsHeader}>
          <TouchableOpacity onPress={() => setShowComments(false)} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#4ECDC4" />
          </TouchableOpacity>      
          <Text style={styles.commentsTitle}>Yorumlar</Text>
        </BlurView>
        <BlurView intensity={80} tint="dark" style={styles.selectedMessageContainer}>
          {/* <Image source={{ uri: selectedMessage.profileImage }} style={styles.selectedMessageProfileImage} /> */}
          <View style={styles.selectedMessageContent}>
            <Text style={styles.selectedMessageUsername}>{selectedMessage.user}</Text>
            <Text style={styles.selectedMessageText}>{selectedMessage.text}</Text>
          </View>
        </BlurView>
        <FlatList
          data={selectedMessage.commentList}
          renderItem={renderCommentItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.commentsList}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <BlurView intensity={100} tint="dark" style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Yorum ekleyin..."
              placeholderTextColor="#aaa"
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity style={styles.commentButton} onPress={handleAddComment}>
              <Ionicons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );

  const renderMainScreen = () => (
    <LinearGradient
      colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.4)']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <BlurView intensity={80} tint="dark" style={styles.agendaContainer}>
          <Text style={styles.agendaTitle}>📅 Üniversite Gündemi</Text>
          <Text style={styles.agendaText}>Bu haftanın gündemi:</Text>
          <View style={styles.eventList}>
            <View style={styles.eventItem}>
              <MaterialIcons name="event" size={20} color="#4ECDC4" />
              <Text style={styles.eventText}>📍 Öğrenci Topluluğu Tanıtım Günü - 21 Ekim</Text>
            </View>
          </View>
        </BlurView>
        
        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <BlurView intensity={100} tint="dark" style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Mesajınızı yazın..."
              placeholderTextColor="#aaa"
              value={newMessage}
              onChangeText={setNewMessage}
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Ionicons name="send" size={24} color="#fff" />
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
  <>
    {showComments ? renderComments() : renderMainScreen()}
    {renderOptionsModal()}
  </>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  agendaContainer: {
    padding: 15,
    borderRadius: 10,
    margin: 10,
    overflow: 'hidden',
  },
  agendaTitle: {
    fontSize: screenWidth * 0.055,
    color: '#4ECDC4',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center", // Dikey eksende ortala
    alignItems: "center", // Yatay eksende ortala
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Arka plan karartması
  },
  modalContent: {
    width: 200, // Daha küçük modal genişliği
    padding: 15, // İçerik boşluğu
    backgroundColor: "rgba(255, 255, 255, 0.95)", // Modal arka planı
    borderRadius: 12, // Köşeleri yuvarlatma
    alignItems: "center", // İçeriği ortala
  },
  optionButton: {
    width: "90%", // Buton genişliği modal genişliğine uyumlu
    paddingVertical: 8, // Daha küçük dikey boşluk
    marginBottom: 8, // Butonlar arası daha dar boşluk
    borderRadius: 6, // Köşeleri yuvarlatma
    backgroundColor: "#007BFF", // Buton rengi (mavi)
    alignItems: "center", // Yazıyı ortala
  },
  optionText: {
    color: "#fff", // Yazı rengi
    fontSize: 14, // Daha küçük yazı boyutu
    fontWeight: "600", // Orta kalınlıkta yazı
  },
  agendaText: {
    fontSize: screenWidth * 0.04,
    color: '#fff',
    marginBottom: 10,
  },
  eventList: {
    marginTop: 5,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78,205,196,0.1)',
    padding: 10,
    borderRadius: 5,
  },
  eventText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: screenWidth * 0.035,
  },
  messageList: {
    paddingHorizontal: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    overflow: 'hidden',
  },
 profileImage: {
    display: 'none', // Profil resmini gizle
  },
  messageContent: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  username: {
    fontWeight: 'bold',
    fontSize: screenWidth * 0.04,
    color: '#4ECDC4',
  },
  timestamp: {
    color: '#aaa',
    fontSize: screenWidth * 0.03,
  },
  messageText: {
    fontSize: screenWidth * 0.035,
    color: '#fff',
    marginBottom: 10,
  },
  actionRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start', // solda hizala
},
  actionButton: {
    flexDirection: 'row', // Align text and icon horizontally
    alignItems: 'center',
    marginRight: 15, // Add some space between buttons
  },
  actionText: {
  fontSize: screenWidth * 0.035,
  color: '#aaa',
  marginRight: 5, // butonlar arasındaki mesafeyi ayarlayın
},
  liked: {
    color: '#4ECDC4',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: screenWidth * 0.04,
    color: '#fff',
  },
  moreOptionsButton: {
    marginLeft: 'auto', // Sağda hizalayacak
    padding: 5,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#4ECDC4',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    marginRight: 15,
  },
  commentsTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  selectedMessageContainer: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  selectedMessageProfileImage: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: screenWidth * 0.05,
    marginRight: 10,
  },
  selectedMessageContent: {
    flex: 1,
  },
  selectedMessageUsername: {
    fontWeight: 'bold',
    fontSize: screenWidth * 0.04,
    color: '#4ECDC4',
    marginBottom: 5,
  },
  selectedMessageText: {
    fontSize: screenWidth * 0.035,
    color: '#fff',
  },
  commentsList: {
    paddingHorizontal: 15,
  },
  commentContainer: {
    flexDirection: 'row',
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  commentProfileImage: {
    display: 'none', // Yorumlardaki profil resmini gizle
  },
  commentContent: {
    flex: 1,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  commentUsername: {
    fontWeight: 'bold',
    color: '#4ECDC4',
    fontSize: screenWidth * 0.035,
  },
  commentTimestamp: {
    fontSize: screenWidth * 0.03,
    color: '#aaa',
  },
  commentText: {
    fontSize: screenWidth * 0.035,
    color: '#fff',
    marginBottom: 5,
  },
  commentLikeButton: {
    alignSelf: 'flex-start',
  },
  commentLikeText: {
    fontSize: screenWidth * 0.035,
    color: '#aaa',
  },
  commentLiked: {
    color: '#4ECDC4',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: screenWidth * 0.035,
    color: '#fff',
  },
  commentButton: {
    marginLeft: 10,
    backgroundColor: '#4ECDC4',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});