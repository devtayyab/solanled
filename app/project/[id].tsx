import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { Colors, StatusColors } from '../../constants/Colors';
import { Project } from '../../types';
import {
  ArrowLeft, MapPin, Camera, CheckCircle2,
  Clock, Image as ImageIcon, History, Trash2,
  MessageSquare, Send, Share2
} from 'lucide-react-native';

interface Comment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string };
}

type TabType = 'info' | 'photos' | 'team' | 'comments' | 'history';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [assignedMembers, setAssignedMembers] = useState<any[]>([]);
  const [companyMembers, setCompanyMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const fetchProject = async () => {
    const { data } = await supabase
      .from('projects')
      .select(`*, project_photos(*), project_status_history(*, changed_by_profile:profiles!project_status_history_changed_by_fkey(full_name))`)
      .eq('id', id)
      .maybeSingle();
    if (data) setProject(data);
    setLoading(false);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('project_comments')
      .select('*, profiles(full_name)')
      .eq('project_id', id)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const fetchTeam = async () => {
    setLoadingTeam(true);
    try {
      // 1. Fetch assigned members
      const { data: assignments } = await supabase
        .from('project_assignments')
        .select('*, profiles(full_name, role)')
        .eq('project_id', id);
      setAssignedMembers(assignments || []);

      // 2. Fetch company members if user is admin/signmaker
      const isManager = profile?.role === 'signmaker' || profile?.role === 'sloan_admin' || profile?.role === 'superadmin' || profile?.role === 'admin';
      if (isManager && project?.company_id) {
        const { data: members } = await supabase
          .from('company_members')
          .select('*, profiles(full_name, role)')
          .eq('company_id', project.company_id);
        setCompanyMembers(members || []);
      }
    } catch (e) {
      console.error('Error fetching team:', e);
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => { fetchProject(); }, [id]);

  useEffect(() => {
    if (activeTab === 'comments') fetchComments();
    if (activeTab === 'team') fetchTeam();
  }, [activeTab]);

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('status_pending'), in_progress: t('status_in_progress'),
      installed: t('status_installed'), completed: t('status_completed'), cancelled: t('status_cancelled'),
    };
    return map[status] || status;
  };

  const handleMarkInstalled = async () => {

    setInstalling(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const { error } = await supabase.from('projects').update({
        status: 'installed',
        gps_lat: lat,
        gps_lng: lng,
        installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      if (error) throw error;

      await supabase.from('project_status_history').insert({
        project_id: id,
        changed_by: profile?.id,
        old_status: project?.status,
        new_status: 'installed',
        notes: lat ? `GPS captured: ${lat.toFixed(5)}, ${lng?.toFixed(5)}` : 'Marked as installed',
      });

      await fetchProject();
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    } finally {
      setInstalling(false);
    }
  };
  
  const handleMarkCompleted = async () => {
    setInstalling(true);
    try {
      const { error } = await supabase.from('projects').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      if (error) throw error;

      await supabase.from('project_status_history').insert({
        project_id: id,
        changed_by: profile?.id,
        old_status: project?.status,
        new_status: 'completed',
        notes: 'Company admin marked project as complete',
      });

      await fetchProject();
    } catch (e: any) {
      Alert.alert(t('error'), e.message);
    } finally {
      setInstalling(false);
    }
  };

  const addPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (result.canceled || !result.assets[0] || !profile) return;

    setLoading(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();
      const mime = blob.type || 'image/jpeg';
      
      // Absolute flat path to avoid any folder-related RLS blocks
      const path = `install-${id}-${Date.now()}.jpeg`;
      const file = new File([blob], path, { type: mime });
      
      const { error: uploadError } = await supabase.storage
        .from('project-photos')
        .upload(path, file, {
          contentType: mime,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-photos')
        .getPublicUrl(path);

      // 3. Save to Database
      const { data, error: dbError } = await supabase.from('project_photos').insert({
        project_id: id,
        uploaded_by: profile.id,
        url: publicUrl,
        caption: '',
      }).select().single();

      if (dbError) throw dbError;

      if (data) {
        setProject(prev => prev ? { ...prev, project_photos: [...(prev.project_photos || []), data] } : prev);
      }
    } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    await supabase.from('project_photos').delete().eq('id', photoId);
    setProject(prev => prev ? { ...prev, project_photos: prev.project_photos?.filter(p => p.id !== photoId) } : prev);
  };

  const sendComment = async () => {
    if (!commentInput.trim() || !profile?.id) return;
    setSendingComment(true);
    const { data } = await supabase.from('project_comments').insert({
      project_id: id,
      user_id: profile.id,
      content: commentInput.trim(),
    }).select('*, profiles(full_name)').single();
    if (data) setComments(prev => [...prev, data]);
    setCommentInput('');
    setSendingComment(false);
  };

  const toggleAssignment = async (userId: string) => {
    const existing = assignedMembers.find(m => m.user_id === userId);
    if (existing) {
      const { error } = await supabase.from('project_assignments').delete().eq('id', existing.id);
      if (!error) setAssignedMembers(prev => prev.filter(m => m.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('project_assignments').insert({
        project_id: id,
        user_id: userId,
        assigned_by: profile?.id,
        can_view: true,
        can_upload_photos: true,
      }).select('*, profiles(full_name, role)').single();
      if (!error && data) setAssignedMembers(prev => [...prev, data]);
      else if (error) Alert.alert('Error', error.message);
    }
  };

  const handleShare = async () => {
    if (!project) return;
    setSharing(true);
    try {
      const statusLabel = getStatusLabel(project.status);
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${project.title} - SloanLED Project Report</title>
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #1F2937; }
  .header { background: #0F2044; color: #fff; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
  .brand { font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }
  h1 { margin: 8px 0 4px; font-size: 24px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 8px; background: #D1FAE5; color: #065F46; }
  .section { margin-bottom: 20px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; }
  .section h2 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase; color: #6B7280; letter-spacing: 0.5px; }
  .row { margin-bottom: 8px; }
  .label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; }
  .value { font-size: 14px; color: #1F2937; margin-top: 2px; }
  .photos-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .photo-count { font-size: 14px; color: #374151; }
  .footer { text-align: center; font-size: 11px; color: #9CA3AF; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB; }
  .history-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #E5E7EB; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #3B82F6; margin-top: 4px; flex-shrink: 0; }
</style>
</head>
<body>
<div class="header">
  <div class="brand">SloanLED · Project Report</div>
  <h1>${project.title}</h1>
  <div class="status">${statusLabel}</div>
</div>

<div class="section">
  <h2>Project Details</h2>
  ${project.description ? `<div class="row"><div class="label">Description</div><div class="value">${project.description}</div></div>` : ''}
  ${project.location_address ? `<div class="row"><div class="label">Location</div><div class="value">${project.location_address}</div></div>` : ''}
  ${project.gps_lat ? `<div class="row"><div class="label">GPS Coordinates</div><div class="value">${project.gps_lat.toFixed(5)}, ${project.gps_lng?.toFixed(5)}</div></div>` : ''}
  ${project.notes ? `<div class="row"><div class="label">Notes</div><div class="value">${project.notes}</div></div>` : ''}
  <div class="row"><div class="label">Created</div><div class="value">${formatDate(project.created_at)}</div></div>
  ${project.installed_at ? `<div class="row"><div class="label">Installed</div><div class="value">${formatDate(project.installed_at)}</div></div>` : ''}
</div>

<div class="section">
  <h2>Photos</h2>
  <div class="photo-count">${project.project_photos?.length || 0} photo(s) attached to this project</div>
</div>

${(project.project_status_history?.length || 0) > 0 ? `
<div class="section">
  <h2>Status History</h2>
  ${project.project_status_history?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(h => `
    <div class="history-item">
      <div class="dot"></div>
      <div>
        <div class="value">${h.old_status ? getStatusLabel(h.old_status) + ' → ' : ''}${getStatusLabel(h.new_status)}</div>
        ${h.notes ? `<div class="label">${h.notes}</div>` : ''}
        <div class="label">${formatDate(h.created_at)}</div>
      </div>
    </div>
  `).join('')}
</div>
` : ''}

<div class="footer">Generated by SloanLED Mobile App · ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable && FileSystem.cacheDirectory) {
        const fileUri = `${FileSystem.cacheDirectory}project_${id}.html`;
        await FileSystem.writeAsStringAsync(fileUri, html);
        await Sharing.shareAsync(fileUri, { mimeType: 'text/html', dialogTitle: `Export ${project.title}` });
      } else {
        const textSummary = [
          `Project: ${project.title}`,
          project.description ? `Description: ${project.description}` : '',
          `Status: ${getStatusLabel(project.status)}`,
          project.location_address ? `Location: ${project.location_address}` : '',
          project.gps_lat ? `GPS: ${project.gps_lat.toFixed(5)}, ${project.gps_lng?.toFixed(5)}` : '',
          project.notes ? `Notes: ${project.notes}` : '',
          `Created: ${formatDate(project.created_at)}`,
          project.installed_at ? `Installed: ${formatDate(project.installed_at)}` : '',
          `Photos: ${project.project_photos?.length || 0}`,
        ].filter(Boolean).join('\n');
        Alert.alert('Project Summary', textSummary);
      }
    } catch {
      Alert.alert('Share', 'Unable to share at this time.');
    } finally {
      setSharing(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatCommentTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.notFound}>Project not found</Text>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}><Text style={styles.back}>Go back</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sc = StatusColors[project.status];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}>
          <ArrowLeft size={20} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{project.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: sc?.bg }]}>
          <View style={[styles.dot, { backgroundColor: sc?.dot }]} />
          <Text style={[styles.statusText, { color: sc?.text }]}>{getStatusLabel(project.status)}</Text>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
          {sharing ? <ActivityIndicator size="small" color={Colors.primary[600]} /> : <Share2 size={18} color={Colors.primary[600]} />}
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['info', 'photos', 'team', 'comments', 'history'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'info' ? 'Info'
                : tab === 'photos' ? `Photos (${project.project_photos?.length || 0})`
                : tab === 'team' ? 'Team'
                : tab === 'comments' ? 'Comments'
                : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'comments' ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={110}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 8 }}>
            {comments.length === 0 ? (
              <View style={styles.emptySection}>
                <MessageSquare size={40} color={Colors.neutral[300]} />
                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
              </View>
            ) : (
              comments.map(comment => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {(comment.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{comment.profiles?.full_name || 'User'}</Text>
                      <Text style={styles.commentTime}>{formatCommentTime(comment.created_at)}</Text>
                    </View>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.commentInputBar}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor={Colors.neutral[400]}
              value={commentInput}
              onChangeText={setCommentInput}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, (!commentInput.trim() || sendingComment) && styles.sendBtnDisabled]}
              onPress={sendComment}
              disabled={!commentInput.trim() || sendingComment}
            >
              {sendingComment ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'info' && (
            <View style={styles.infoSection}>
              {project.description ? (
                <InfoRow label="Description" value={project.description} />
              ) : null}
              {project.location_address ? (
                <InfoRow label="Location" value={project.location_address} icon={<MapPin size={14} color={Colors.primary[500]} />} />
              ) : null}
              {project.gps_lat ? (
                <InfoRow label="GPS Coordinates" value={`${project.gps_lat.toFixed(5)}, ${project.gps_lng?.toFixed(5)}`} />
              ) : null}
              {project.notes ? <InfoRow label="Notes" value={project.notes} /> : null}
              <InfoRow label="Created" value={formatDate(project.created_at)} icon={<Clock size={14} color={Colors.neutral[400]} />} />
              {project.installed_at ? <InfoRow label="Installed" value={formatDate(project.installed_at)} icon={<CheckCircle2 size={14} color={Colors.success[500]} />} /> : null}

              {project.status !== 'installed' && project.status !== 'completed' && (
                <TouchableOpacity
                  style={[styles.installBtn, installing && styles.installBtnDisabled]}
                  onPress={handleMarkInstalled}
                  disabled={installing}
                >
                  {installing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <CheckCircle2 size={18} color="#fff" />
                  )}
                  <Text style={styles.installBtnText}>{t('mark_installed')}</Text>
                </TouchableOpacity>
              )}

              {project.status === 'installed' && (profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'sloan_admin') && (
                <TouchableOpacity
                  style={[styles.installBtn, { backgroundColor: Colors.success[600] }, installing && styles.installBtnDisabled]}
                  onPress={handleMarkCompleted}
                  disabled={installing}
                >
                  {installing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <CheckCircle2 size={18} color="#fff" />
                  )}
                  <Text style={styles.installBtnText}>Mark as Complete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeTab === 'photos' && (
            <View style={styles.photosSection}>
              <TouchableOpacity style={styles.addPhotoBtn} onPress={addPhoto}>
                <Camera size={18} color={Colors.primary[600]} />
                <Text style={styles.addPhotoBtnText}>Take Photo</Text>
              </TouchableOpacity>

              {(project.project_photos?.length || 0) === 0 ? (
                <View style={styles.emptySection}>
                  <ImageIcon size={40} color={Colors.neutral[300]} />
                  <Text style={styles.emptyText}>No photos yet</Text>
                </View>
              ) : (
                <View style={styles.photoGrid}>
                  {project.project_photos?.map(photo => (
                    <View key={photo.id} style={styles.photoItem}>
                      {!photo.url.startsWith('file://') ? (
                        <Image source={{ uri: photo.url }} style={styles.photoImg} />
                      ) : (
                        <View style={[styles.photoImg, { backgroundColor: Colors.neutral[100], justifyContent: 'center', alignItems: 'center' }]}>
                          <ImageIcon size={24} color={Colors.neutral[300]} />
                        </View>
                      )}
                      {profile?.id === photo.uploaded_by && (
                        <TouchableOpacity
                          style={styles.deletePhoto}
                          onPress={() => deletePhoto(photo.id)}
                        >
                          <Trash2 size={12} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'team' && (
            <View style={styles.teamSection}>
              {loadingTeam ? (
                <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: 20 }} />
              ) : (
                <>
                  <Text style={styles.tabTitle}>Assigned Team Members</Text>
                  {assignedMembers.length === 0 ? (
                    <Text style={styles.emptyTextSub}>No one is assigned to this project yet.</Text>
                  ) : (
                    assignedMembers.map(m => (
                      <View key={m.id} style={styles.assignedCard}>
                        <View style={styles.memberRowLeft}>
                          <View style={styles.miniAvatar}>
                            <Text style={styles.miniAvatarText}>{(m.profiles?.full_name || 'U').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View>
                            <Text style={styles.mName}>{m.profiles?.full_name || 'Unknown'}</Text>
                            <Text style={styles.mRole}>{m.profiles?.role}</Text>
                          </View>
                        </View>
                        {(profile?.role === 'signmaker' || profile?.role === 'sloan_admin' || profile?.role === 'superadmin') && (
                          <TouchableOpacity onPress={() => toggleAssignment(m.user_id)}>
                            <Trash2 size={16} color={Colors.error[500]} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}

                  {(profile?.role === 'signmaker' || profile?.role === 'sloan_admin' || profile?.role === 'superadmin') && (
                    <>
                      <Text style={[styles.tabTitle, { marginTop: 24 }]}>Available Team Members</Text>
                      {companyMembers
                        .filter(cm => !assignedMembers.some(am => am.user_id === cm.user_id))
                        .map(cm => (
                          <TouchableOpacity key={cm.id} style={styles.memberSelectCard} onPress={() => toggleAssignment(cm.user_id)}>
                            <View style={styles.memberRowLeft}>
                              <View style={[styles.miniAvatar, { backgroundColor: Colors.neutral[200] }]}>
                                <Text style={[styles.miniAvatarText, { color: Colors.neutral[600] }]}>{(cm.profiles?.full_name || 'U').charAt(0).toUpperCase()}</Text>
                              </View>
                              <View>
                                <Text style={styles.mName}>{cm.profiles?.full_name || 'Unknown'}</Text>
                                <Text style={styles.mRole}>{cm.role || cm.profiles?.role}</Text>
                              </View>
                            </View>
                            <View style={styles.addMemberBtn}>
                              <Text style={styles.addMemberBtnText}>Assign</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      {companyMembers.length === 0 && <Text style={styles.emptyTextSub}>No other members found in your company.</Text>}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {activeTab === 'history' && (
            <View style={styles.historySection}>
              {(project.project_status_history?.length || 0) === 0 ? (
                <View style={styles.emptySection}>
                  <History size={40} color={Colors.neutral[300]} />
                  <Text style={styles.emptyText}>No history yet</Text>
                </View>
              ) : (
                project.project_status_history?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(item => (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={[styles.historyDot, { backgroundColor: StatusColors[item.new_status]?.dot || Colors.neutral[400] }]} />
                    <View style={styles.historyContent}>
                      <Text style={styles.historyStatus}>
                        {item.old_status ? `${getStatusLabel(item.old_status)} → ` : ''}{getStatusLabel(item.new_status)}
                      </Text>
                      {item.notes ? <Text style={styles.historyNotes}>{item.notes}</Text> : null}
                      <Text style={styles.historyDate}>{formatDate(item.created_at)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowHeader}>
        {icon}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.neutral[600] },
  back: { fontFamily: 'Inter-Medium', fontSize: 14, color: Colors.primary[600], marginTop: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, fontFamily: 'Inter-SemiBold', fontSize: 16, color: Colors.neutral[900] },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },
  shareBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center', alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.neutral[100],
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary[600] },
  tabText: { fontFamily: 'Inter-Medium', fontSize: 12, color: Colors.neutral[500] },
  tabTextActive: { color: Colors.primary[600], fontFamily: 'Inter-SemiBold' },
  content: { flex: 1 },
  infoSection: { padding: 16, gap: 12 },
  infoRow: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.neutral[100],
  },
  infoRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoLabel: { fontFamily: 'Inter-Medium', fontSize: 11, color: Colors.neutral[500], textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[800], lineHeight: 20 },
  installBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.success[600], borderRadius: 14, padding: 16,
    marginTop: 8, shadowColor: Colors.success[600],
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  installBtnDisabled: { opacity: 0.7 },
  installBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#fff' },
  photosSection: { padding: 16 },
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary[200], borderRadius: 12,
    padding: 14, backgroundColor: Colors.primary[50], borderStyle: 'dashed',
    marginBottom: 16,
  },
  addPhotoBtnText: { fontFamily: 'Inter-Medium', fontSize: 14, color: Colors.primary[600] },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { position: 'relative' },
  photoImg: { width: 108, height: 108, borderRadius: 12 },
  deletePhoto: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
  },
  emptySection: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[400], textAlign: 'center' },
  historySection: { padding: 16, gap: 0 },
  historyItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.neutral[100] },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  historyContent: { flex: 1 },
  historyStatus: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.neutral[800] },
  historyNotes: { fontFamily: 'Inter-Regular', fontSize: 12, color: Colors.neutral[500], marginTop: 2 },
  historyDate: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400], marginTop: 4 },
  commentCard: {
    flexDirection: 'row', gap: 10, backgroundColor: '#fff',
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.neutral[100],
  },
  commentAvatar: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  commentAvatarText: { fontFamily: 'Inter-Bold', fontSize: 13, color: '#fff' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.neutral[800] },
  commentTime: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[400] },
  commentContent: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[700], lineHeight: 18 },
  commentInputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: Colors.neutral[100],
  },
  commentInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: 'Inter-Regular', fontSize: 14, color: Colors.neutral[900],
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.neutral[300] },
  teamSection: { padding: 16 },
  tabTitle: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: Colors.neutral[800], marginBottom: 12 },
  assignedCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.neutral[100],
  },
  memberSelectCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.neutral[100], borderStyle: 'dashed',
  },
  memberRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniAvatar: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.primary[600],
    justifyContent: 'center', alignItems: 'center',
  },
  miniAvatarText: { fontFamily: 'Inter-Bold', fontSize: 12, color: '#fff' },
  mName: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: Colors.neutral[800] },
  mRole: { fontFamily: 'Inter-Regular', fontSize: 11, color: Colors.neutral[500] },
  addMemberBtn: {
    backgroundColor: Colors.primary[50], paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  addMemberBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 11, color: Colors.primary[600] },
  emptyTextSub: { fontFamily: 'Inter-Regular', fontSize: 13, color: Colors.neutral[400], textAlign: 'center', marginTop: 10 },
});
