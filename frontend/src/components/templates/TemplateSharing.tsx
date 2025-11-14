/**
 * TemplateSharing - Collaboration and Sharing Features
 * Advanced template sharing, collaboration, and distribution interface
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XMarkIcon,
  ShareIcon,
  LinkIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  FolderIcon,
  TagIcon,
  GlobeAltIcon,
  LockClosedIcon,
  LockOpenIcon,
  UserIcon,
  UsersIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  BellIcon,
  BookmarkIcon,
  HeartIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { EyeIcon as EyeIconSolid, StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { templateService } from '../../../src/services/templateService';
import {
  Template,
  TemplateShare,
  TemplateCollection,
  TemplateComment,
  TemplateReview,
  SharePermissions,
} from '../../../src/types/template';

interface TemplateSharingProps {
  template: Template;
  onClose: () => void;
  className?: string;
}

type ShareType = 'public' | 'organization' | 'team' | 'user' | 'link';
type ShareLevel = 'view' | 'comment' | 'edit' | 'admin';
type ExportFormat = 'json' | 'pdf' | 'html' | 'word' | 'excel';

export const TemplateSharing: React.FC<TemplateSharingProps> = ({
  template,
  onClose,
  className = '',
}) => {
  // State Management
  const [activeTab, setActiveTab] = useState<'share' | 'embed' | 'export' | 'analytics' | 'reviews'>('share');
  const [shares, setShares] = useState<TemplateShare[]>([]);
  const [collections, setCollections] = useState<TemplateCollection[]>([]);
  const [comments, setComments] = useState<TemplateComment[]>([]);
  const [reviews, setReviews] = useState<TemplateReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Share creation state
  const [shareType, setShareType] = useState<ShareType>('link');
  const [shareLevel, setShareLevel] = useState<ShareLevel>('view');
  const [shareEmail, setShareEmail] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareExpires, setShareExpires] = useState(false);
  const [shareExpiryDate, setShareExpiryDate] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [sharePasswordEnabled, setSharePasswordEnabled] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Embed settings
  const [embedSettings, setEmbedSettings] = useState({
    width: '100%',
    height: '600px',
    theme: 'light' as 'light' | 'dark',
    showHeader: true,
    showBranding: true,
    allowFullscreen: true,
    autoPlay: false,
    language: 'auto' as 'auto' | 'pl' | 'en',
  });

  // Export settings
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [exportOptions, setExportOptions] = useState({
    includeAnalytics: false,
    includeComments: false,
    includeReviews: false,
    includeVersionHistory: false,
    customBranding: false,
  });

  // Analytics data
  const [analytics, setAnalytics] = useState({
    views: 0,
    downloads: 0,
    shares: 0,
    comments: 0,
    averageRating: 0,
    usageByRegion: {} as Record<string, number>,
    usageOverTime: [] as Array<{ date: string; views: number; downloads: number }>,
    topReferrers: [] as Array<{ source: string; count: number }>,
    engagementMetrics: {
      avgTimeOnPage: 0,
      bounceRate: 0,
      completionRate: 0,
    },
  });

  // Review form
  const [reviewForm, setReviewForm] = useState({
    rating: 0,
    title: '',
    content: '',
    anonymous: false,
  });

  // Effects
  useEffect(() => {
    loadShares();
    loadCollections();
    loadComments();
    loadReviews();
    loadAnalytics();
  }, []);

  // Data loading functions
  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const templateShares = await templateService.getTemplateShares(template.id);
      setShares(templateShares);
    } catch (error) {
      console.error('Failed to load shares:', error);
    } finally {
      setLoading(false);
    }
  }, [template.id]);

  const loadCollections = useCallback(async () => {
    try {
      const userCollections = await templateService.getCollections();
      setCollections(userCollections);
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  }, []);

  const loadComments = useCallback(async () => {
    try {
      const templateComments = await templateService.getTemplateComments(template.id);
      setComments(templateComments.data || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  }, [template.id]);

  const loadReviews = useCallback(async () => {
    try {
      const templateReviews = await templateService.getTemplateReviews(template.id);
      setReviews(templateReviews.data || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  }, [template.id]);

  const loadAnalytics = useCallback(async () => {
    try {
      const templateAnalytics = await templateService.getTemplateAnalytics(template.id);
      setAnalytics(templateAnalytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }, [template.id]);

  // Share creation and management
  const createShare = useCallback(async () => {
    setLoading(true);
    try {
      const shareData = {
        shareType: shareType === 'link' ? 'public' : shareType,
        permissions: {
          canView: true,
          canCopy: shareLevel === 'edit' || shareLevel === 'admin',
          canEdit: shareLevel === 'edit' || shareLevel === 'admin',
          canShare: shareLevel === 'admin',
          canDownload: shareLevel !== 'view',
          canComment: shareLevel !== 'view',
        } as SharePermissions,
        expiresAt: shareExpires ? new Date(shareExpiryDate) : undefined,
      };

      const newShare = await templateService.shareTemplate(template.id, shareData);
      setShares(prev => [newShare, ...prev]);
      setGeneratedLink(`${window.location.origin}/templates/shared/${newShare.shareToken}`);
    } catch (error) {
      setError('Failed to create share link');
      console.error('Failed to create share:', error);
    } finally {
      setLoading(false);
    }
  }, [template.id, shareType, shareLevel, shareExpires, shareExpiryDate]);

  const revokeShare = useCallback(async (shareId: string) => {
    try {
      await templateService.revokeTemplateShare(template.id, shareId);
      setShares(prev => prev.filter(share => share.id !== shareId));
    } catch (error) {
      console.error('Failed to revoke share:', error);
    }
  }, [template.id]);

  const copyShareLink = useCallback(async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  }, []);

  // Collection management
  const addToCollection = useCallback(async (collectionId: string) => {
    try {
      await templateService.addToCollection(collectionId, template.id);
      // Update collections to reflect the change
    } catch (error) {
      console.error('Failed to add to collection:', error);
    }
  }, [template.id]);

  const removeFromCollection = useCallback(async (collectionId: string) => {
    try {
      await templateService.removeFromCollection(collectionId, template.id);
      // Update collections to reflect the change
    } catch (error) {
      console.error('Failed to remove from collection:', error);
    }
  }, [template.id]);

  // Export functionality
  const exportTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const blob = await templateService.exportTemplate(template.id, exportFormat as any);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.slug}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError('Failed to export template');
      console.error('Failed to export:', error);
    } finally {
      setLoading(false);
    }
  }, [template.id, exportFormat, template.slug]);

  // Review submission
  const submitReview = useCallback(async () => {
    if (reviewForm.rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      await templateService.addTemplateReview(template.id, {
        rating: reviewForm.rating,
        title: reviewForm.title,
        comment: reviewForm.content,
        anonymous: reviewForm.anonymous,
        approved: false, // Will need approval
      } as any);

      // Reset form and reload reviews
      setReviewForm({ rating: 0, title: '', content: '', anonymous: false });
      loadReviews();
    } catch (error) {
      setError('Failed to submit review');
      console.error('Failed to submit review:', error);
    }
  }, [template.id, reviewForm, loadReviews]);

  // Comment submission
  const submitComment = useCallback(async (content: string, parentId?: string) => {
    try {
      await templateService.addTemplateComment(template.id, {
        content,
        parentId,
      } as any);
      loadComments();
    } catch (error) {
      console.error('Failed to submit comment:', error);
    }
  }, [template.id, loadComments]);

  // Generate embed code
  const generateEmbedCode = useCallback(() => {
    const baseUrl = `${window.location.origin}/embed/template/${template.id}`;
    const params = new URLSearchParams({
      theme: embedSettings.theme,
      header: embedSettings.showHeader.toString(),
      branding: embedSettings.showBranding.toString(),
      fullscreen: embedSettings.allowFullscreen.toString(),
      autoplay: embedSettings.autoPlay.toString(),
      language: embedSettings.language,
      width: embedSettings.width,
      height: embedSettings.height,
    });

    return `<iframe src="${baseUrl}?${params.toString()}" width="${embedSettings.width}" height="${embedSettings.height}" frameborder="0" allowfullscreen></iframe>`;
  }, [template.id, embedSettings]);

  // Render tab content
  const renderShareTab = () => (
    <div className="space-y-6">
      {/* Create New Share */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Share Link</h3>

        {/* Share Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Share Type</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { id: 'public', label: 'Public', icon: GlobeAltIcon, description: 'Anyone with link' },
              { id: 'organization', label: 'Organization', icon: BuildingOfficeIcon, description: 'Your organization' },
              { id: 'team', label: 'Team', icon: UserGroupIcon, description: 'Your team members' },
              { id: 'user', label: 'Specific User', icon: UserIcon, description: 'Individual person' },
              { id: 'link', label: 'Share Link', icon: LinkIcon, description: 'Anyone with link' },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setShareType(type.id as ShareType)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  shareType === type.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <type.icon className={`w-6 h-6 ${shareType === type.id ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-xs font-medium ${shareType === type.id ? 'text-blue-600' : 'text-gray-700'}`}>
                  {type.label}
                </span>
                <span className="text-xs text-gray-500 text-center">{type.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Permission Level */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Permission Level</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: 'view', label: 'View Only', icon: EyeIcon, description: 'Can only view' },
              { id: 'comment', label: 'Comment', icon: ChatBubbleLeftRightIcon, description: 'Can view and comment' },
              { id: 'edit', label: 'Edit', icon: PencilIcon, description: 'Can view, comment, and edit' },
              { id: 'admin', label: 'Admin', icon: Cog6ToothIcon, description: 'Full access' },
            ].map(level => (
              <button
                key={level.id}
                onClick={() => setShareLevel(level.id as ShareLevel)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                  shareLevel === level.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <level.icon className={`w-5 h-5 ${shareLevel === level.id ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${shareLevel === level.id ? 'text-green-600' : 'text-gray-700'}`}>
                  {level.label}
                </span>
                <span className="text-xs text-gray-500 text-center">{level.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Specific User (if selected) */}
        {shareType === 'user' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">User Email</label>
            <input
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Message */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Personal Message (Optional)</label>
          <textarea
            value={shareMessage}
            onChange={(e) => setShareMessage(e.target.value)}
            rows={3}
            placeholder="Add a personal message for the recipient..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Expiration */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shareExpires}
              onChange={(e) => setShareExpires(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Set expiration date</span>
          </label>
          {shareExpires && (
            <input
              type="datetime-local"
              value={shareExpiryDate}
              onChange={(e) => setShareExpiryDate(e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>

        {/* Password Protection */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sharePasswordEnabled}
              onChange={(e) => setSharePasswordEnabled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Password protection</span>
          </label>
          {sharePasswordEnabled && (
            <input
              type="password"
              value={sharePassword}
              onChange={(e) => setSharePassword(e.target.value)}
              placeholder="Enter password..."
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
        </div>

        {/* Create Button */}
        <button
          onClick={createShare}
          disabled={loading || (shareType === 'user' && !shareEmail)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Creating...
            </>
          ) : (
            <>
              <ShareIcon className="w-5 h-5" />
              Create Share Link
            </>
          )}
        </button>
      </div>

      {/* Generated Link */}
      {generatedLink && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">Share Link Created!</h3>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={generatedLink}
              readOnly
              className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg"
            />
            <button
              onClick={() => copyShareLink(generatedLink)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="text-sm text-green-800">
            Share this link with others. They will have the permissions you specified.
          </div>
        </div>
      )}

      {/* Existing Shares */}
      {shares.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Shares</h3>
          <div className="space-y-3">
            {shares.map(share => (
              <div key={share.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    share.shareType === 'public' ? 'bg-blue-100 text-blue-600' :
                    share.shareType === 'organization' ? 'bg-purple-100 text-purple-600' :
                    share.shareType === 'team' ? 'bg-green-100 text-green-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {share.shareType === 'public' ? <GlobeAltIcon className="w-5 h-5" /> :
                     share.shareType === 'organization' ? <BuildingOfficeIcon className="w-5 h-5" /> :
                     share.shareType === 'team' ? <UserGroupIcon className="w-5 h-5" /> :
                     <UserIcon className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 capitalize">{share.shareType}</div>
                    <div className="text-sm text-gray-500">
                      {share.permissions.canEdit ? 'Can edit' : 'View only'} • {share.accessCount} accesses
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {share.expiresAt && (
                    <div className="text-sm text-gray-500">
                      Expires {new Date(share.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                  <button
                    onClick={() => revokeShare(share.id)}
                    className="p-2 text-red-600 hover:text-red-800"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderEmbedTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Embed Template</h3>
        <p className="text-gray-600 mb-6">
          Embed this template in your website, blog, or learning management system.
        </p>

        {/* Embed Settings */}
        <div className="space-y-4 mb-6">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'light', label: 'Light', preview: 'bg-white border border-gray-300' },
                { id: 'dark', label: 'Dark', preview: 'bg-gray-800 border border-gray-600' },
              ].map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setEmbedSettings(prev => ({ ...prev, theme: theme.id as any }))}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    embedSettings.theme === theme.id ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded ${theme.preview}`}></div>
                  <span className="font-medium">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Width</label>
              <input
                type="text"
                value={embedSettings.width}
                onChange={(e) => setEmbedSettings(prev => ({ ...prev, width: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Height</label>
              <input
                type="text"
                value={embedSettings.height}
                onChange={(e) => setEmbedSettings(prev => ({ ...prev, height: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {[
              { id: 'showHeader', label: 'Show header', description: 'Display template title and information' },
              { id: 'showBranding', label: 'Show branding', description: 'Display workshopsAI branding' },
              { id: 'allowFullscreen', label: 'Allow fullscreen', description: 'Enable fullscreen mode' },
              { id: 'autoPlay', label: 'Auto-play', description: 'Automatically start presentations' },
            ].map(option => (
              <label key={option.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={embedSettings[option.id as keyof typeof embedSettings] as boolean}
                  onChange={(e) => setEmbedSettings(prev => ({ ...prev, [option.id]: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Language</label>
            <select
              value={embedSettings.language}
              onChange={(e) => setEmbedSettings(prev => ({ ...prev, language: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="auto">Auto-detect</option>
              <option value="pl">Polish</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* Generated Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Embed Code</label>
          <div className="relative">
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
              <code>{generateEmbedCode()}</code>
            </pre>
            <button
              onClick={() => copyShareLink(generateEmbedCode())}
              className="absolute top-2 right-2 p-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              <DocumentDuplicateIcon className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-2">Template preview would appear here</p>
            <p className="text-sm text-gray-400">Size: {embedSettings.width} × {embedSettings.height}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExportTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Template</h3>
        <p className="text-gray-600 mb-6">
          Download this template in various formats for offline use or integration with other tools.
        </p>

        {/* Export Format */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { id: 'json', label: 'JSON', description: 'Machine-readable format', icon: DocumentTextIcon },
              { id: 'pdf', label: 'PDF', description: 'Print-friendly document', icon: DocumentTextIcon },
              { id: 'html', label: 'HTML', description: 'Web-ready format', icon: GlobeAltIcon },
              { id: 'word', label: 'Word', description: 'Microsoft Word', icon: DocumentTextIcon },
              { id: 'excel', label: 'Excel', description: 'Spreadsheet format', icon: ChartBarIcon },
            ].map(format => (
              <button
                key={format.id}
                onClick={() => setExportFormat(format.id as ExportFormat)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  exportFormat === format.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <format.icon className={`w-6 h-6 ${exportFormat === format.id ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`font-medium ${exportFormat === format.id ? 'text-blue-600' : 'text-gray-700'}`}>
                  {format.label}
                </span>
                <span className="text-xs text-gray-500 text-center">{format.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Export Options */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Export Options</label>
          <div className="space-y-3">
            {[
              { id: 'includeAnalytics', label: 'Include analytics data', description: 'Export usage statistics and metrics' },
              { id: 'includeComments', label: 'Include comments', description: 'Export user comments and feedback' },
              { id: 'includeReviews', label: 'Include reviews', description: 'Export user reviews and ratings' },
              { id: 'includeVersionHistory', label: 'Include version history', description: 'Export all template versions' },
              { id: 'customBranding', label: 'Apply custom branding', description: 'Include your organization branding' },
            ].map(option => (
              <label key={option.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={exportOptions[option.id as keyof typeof exportOptions] as boolean}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, [option.id]: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={exportTemplate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Exporting...
            </>
          ) : (
            <>
              <ArrowDownTrayIcon className="w-5 h-5" />
              Export as {exportFormat.toUpperCase()}
            </>
          )}
        </button>
      </div>

      {/* Collections */}
      {collections.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add to Collection</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {collections.map(collection => (
              <label key={collection.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={collection.templates.includes(template.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      addToCollection(collection.id);
                    } else {
                      removeFromCollection(collection.id);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{collection.name.pl}</div>
                  <div className="text-sm text-gray-500">{collection.templates.length} templates</div>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FolderIcon className="w-4 h-4 text-gray-600" />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderReviewsTab = () => (
    <div className="space-y-6">
      {/* Add Review */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Write a Review</h3>

        {/* Rating */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setReviewForm(prev => ({ ...prev, rating: star }))}
                className="p-1"
              >
                <StarIcon
                  className={`w-8 h-8 ${
                    star <= reviewForm.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Review Title</label>
          <input
            type="text"
            value={reviewForm.title}
            onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Summarize your experience..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Content */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Review</label>
          <textarea
            value={reviewForm.content}
            onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
            rows={4}
            placeholder="Share your thoughts about this template..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Anonymous */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reviewForm.anonymous}
              onChange={(e) => setReviewForm(prev => ({ ...prev, anonymous: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Submit anonymously</span>
          </label>
        </div>

        {/* Submit */}
        <button
          onClick={submitReview}
          disabled={loading || reviewForm.rating === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Review
        </button>
      </div>

      {/* Existing Reviews */}
      {reviews.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reviews ({reviews.length})</h3>
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="border-b border-gray-200 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <StarIcon
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-medium text-gray-900">{review.reviewer}</span>
                    {review.anonymous && (
                      <span className="text-sm text-gray-500">(anonymous)</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {review.title && (
                  <h4 className="font-medium text-gray-900 mb-1">{review.title}</h4>
                )}
                <p className="text-gray-700">{review.comment}</p>
                {review.approved && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckIcon className="w-4 h-4" />
                    Verified review
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      {comments.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments ({comments.length})</h3>
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{comment.author}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-700">{comment.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Analytics</h3>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <EyeIcon className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold text-blue-600">{analytics.views}</span>
            </div>
            <div className="text-sm text-blue-900">Total Views</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <ArrowDownTrayIcon className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{analytics.downloads}</span>
            </div>
            <div className="text-sm text-green-900">Downloads</div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <ShareIcon className="w-5 h-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-600">{analytics.shares}</span>
            </div>
            <div className="text-sm text-purple-900">Shares</div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <StarIcon className="w-5 h-5 text-yellow-600" />
              <span className="text-2xl font-bold text-yellow-600">{analytics.averageRating.toFixed(1)}</span>
            </div>
            <div className="text-sm text-yellow-900">Average Rating</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Usage Over Time</h4>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Chart would be rendered here
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Usage by Region</h4>
            <div className="h-64 flex items-center justify-center text-gray-500">
              Chart would be rendered here
            </div>
          </div>
        </div>

        {/* Engagement Metrics */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h4 className="font-medium text-gray-900 mb-3">Engagement Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Avg. Time on Page</div>
              <div className="text-lg font-semibold text-gray-900">
                {analytics.engagementMetrics.avgTimeOnPage} min
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Bounce Rate</div>
              <div className="text-lg font-semibold text-gray-900">
                {analytics.engagementMetrics.bounceRate}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Completion Rate</div>
              <div className="text-lg font-semibold text-gray-900">
                {analytics.engagementMetrics.completionRate}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`template-sharing ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Share Template</h1>
                <p className="text-sm text-gray-600">{template.title.pl}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4">
            <nav className="flex space-x-8">
              {[
                { id: 'share', label: 'Share', icon: ShareIcon },
                { id: 'embed', label: 'Embed', icon: GlobeAltIcon },
                { id: 'export', label: 'Export', icon: ArrowDownTrayIcon },
                { id: 'reviews', label: 'Reviews', icon: StarIcon },
                { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                  {tab.id === 'reviews' && reviews.length > 0 && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                      {reviews.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {activeTab === 'share' && renderShareTab()}
          {activeTab === 'embed' && renderEmbedTab()}
          {activeTab === 'export' && renderExportTab()}
          {activeTab === 'reviews' && renderReviewsTab()}
          {activeTab === 'analytics' && renderAnalyticsTab()}
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="text-red-900 font-medium">Error</h4>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-600 hover:text-red-800"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateSharing;