/**
 * TemplateGallery - Template Browsing and Discovery
 * Visual gallery for exploring and discovering templates
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  HeartIcon,
  StarIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  BookmarkIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  SparklesIcon,
  FireIcon,
  TrendingUpIcon,
  TagIcon,
  FolderIcon,
  GlobeAltIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  ChevronRightIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid, HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import { templateService, templateHelpers } from '../../../src/services/templateService';
import {
  Template,
  TemplateFilter,
  TemplateCategory,
  TemplateType,
  TemplateDifficulty,
  SearchSort,
} from '../../../src/types/template';

interface TemplateGalleryProps {
  templates?: Template[];
  onSelectTemplate?: (template: Template) => void;
  onEditTemplate?: (template: Template) => void;
  onDuplicateTemplate?: (template: Template) => void;
  onDeleteTemplate?: (template: Template) => void;
  onShareTemplate?: (template: Template) => void;
  onExportTemplate?: (template: Template) => void;
  initialCategory?: TemplateCategory;
  featuredOnly?: boolean;
  showFilters?: boolean;
  maxItems?: number;
  columns?: number;
  className?: string;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  templates: propTemplates,
  onSelectTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onShareTemplate,
  onExportTemplate,
  initialCategory,
  featuredOnly = false,
  showFilters = true,
  maxItems,
  columns = 3,
  className = '',
}) => {
  // State Management
  const [templates, setTemplates] = useState<Template[]>(propTemplates || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | undefined>(initialCategory);
  const [selectedType, setSelectedType] = useState<TemplateType | undefined>();
  const [selectedDifficulty, setSelectedDifficulty] = useState<TemplateDifficulty | undefined>();
  const [sortBy, setSortBy] = useState<SearchSort>('popularity');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry' | 'carousel'>('grid');
  const [showFilters, setShowFilters] = useState(showFilters);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Analytics data
  const [categories, setCategories] = useState<Record<TemplateCategory, number>>({});
  const [trendingTemplates, setTrendingTemplates] = useState<Template[]>([]);
  const [popularTags, setPopularTags] = useState<Array<{ tag: string; count: number }>>([]);

  // Effects
  useEffect(() => {
    if (!propTemplates) {
      loadTemplates();
    }
    loadCategories();
    loadTrendingTemplates();
    loadPopularTags();
  }, []);

  useEffect(() => {
    if (propTemplates) {
      setTemplates(propTemplates);
    }
  }, [propTemplates]);

  // Data loading functions
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: TemplateFilter = {};
      if (selectedCategory) filters.category = [selectedCategory];
      if (selectedType) filters.type = [selectedType];
      if (selectedDifficulty) filters.difficulty = [selectedDifficulty];
      if (featuredOnly) filters.featured = true;

      const response = await templateService.getTemplates(filters, 1, maxItems || 50, sortBy);
      setTemplates(response.data || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load templates');
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedType, selectedDifficulty, sortBy, featuredOnly, maxItems]);

  const loadCategories = useCallback(async () => {
    try {
      const categoryData = await templateService.getCategories();
      setCategories(categoryData);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const loadTrendingTemplates = useCallback(async () => {
    try {
      const trending = await templateService.getPopularTemplates(10, 'week');
      setTrendingTemplates(trending);
    } catch (error) {
      console.error('Failed to load trending templates:', error);
    }
  }, []);

  const loadPopularTags = useCallback(async () => {
    try {
      const tagData = await templateService.getTags();
      const sortedTags = Object.entries(tagData)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));
      setPopularTags(sortedTags);
    } catch (error) {
      console.error('Failed to load popular tags:', error);
    }
  }, []);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.title.pl.toLowerCase().includes(query) ||
        template.title.en.toLowerCase().includes(query) ||
        template.description?.pl.toLowerCase().includes(query) ||
        template.description?.en.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'rating':
          return b.averageRating - a.averageRating;
        case 'popularity':
          return b.usageCount - a.usageCount;
        case 'usage':
          return b.usageCount - a.usageCount;
        case 'name':
          return a.title.pl.localeCompare(b.title.pl);
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

    // Limit results if specified
    if (maxItems) {
      filtered = filtered.slice(0, maxItems);
    }

    return filtered;
  }, [templates, searchQuery, sortBy, maxItems]);

  // Template actions
  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template);
    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      setShowPreviewModal(true);
    }
  }, [onSelectTemplate]);

  const handleToggleFavorite = useCallback(async (templateId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(templateId)) {
        newFavorites.delete(templateId);
      } else {
        newFavorites.add(templateId);
      }
      return newFavorites;
    });

    // Call API to update favorite status
    try {
      // await templateService.toggleFavorite(templateId);
    } catch (error) {
      console.error('Failed to update favorite status:', error);
    }
  }, []);

  const handleToggleBookmark = useCallback(async (templateId: string) => {
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(templateId)) {
        newBookmarks.delete(templateId);
      } else {
        newBookmarks.add(templateId);
      }
      return newBookmarks;
    });

    // Call API to update bookmark status
    try {
      // await templateService.toggleBookmark(templateId);
    } catch (error) {
      console.error('Failed to update bookmark status:', error);
    }
  }, []);

  // Render helper functions
  const renderTemplateCard = useCallback((template: Template) => {
    const isFavorite = favorites.has(template.id);
    const isBookmarked = bookmarks.has(template.id);
    const isHovered = hoveredTemplate === template.id;

    return (
      <div
        key={template.id}
        className="group relative bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
        onMouseEnter={() => setHoveredTemplate(template.id)}
        onMouseLeave={() => setHoveredTemplate(null)}
        onClick={() => handleSelectTemplate(template)}
      >
        {/* Template Image */}
        <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 relative overflow-hidden">
          {template.imageUrl ? (
            <img
              src={template.imageUrl}
              alt={template.title.pl}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center ${
                  template.type === 'workshop'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-green-100 text-green-600'
                }`}>
                  <AcademicCapIcon className="w-8 h-8" />
                </div>
                <div className="text-sm text-gray-600 font-medium">{template.type}</div>
              </div>
            </div>
          )}

          {/* Overlay with actions */}
          <div className={`absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center`}>
            <div className={`opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectTemplate(template);
                }}
                className="p-2 bg-white text-gray-800 rounded-lg hover:bg-gray-100"
                title="Preview"
              >
                <EyeIcon className="w-5 h-5" />
              </button>
              {onExportTemplate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExportTemplate(template);
                  }}
                  className="p-2 bg-white text-gray-800 rounded-lg hover:bg-gray-100"
                  title="Export"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                </button>
              )}
              {onShareTemplate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareTemplate(template);
                  }}
                  className="p-2 bg-white text-gray-800 rounded-lg hover:bg-gray-100"
                  title="Share"
                >
                  <ShareIcon className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite(template.id);
                }}
                className={`p-2 rounded-lg hover:bg-gray-100 ${
                  isFavorite ? 'bg-white text-red-500' : 'bg-white text-gray-800'
                }`}
                title="Favorite"
              >
                {isFavorite ? <HeartIconSolid className="w-5 h-5" /> : <HeartIcon className="w-5 h-5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleBookmark(template.id);
                }}
                className={`p-2 rounded-lg hover:bg-gray-100 ${
                  isBookmarked ? 'bg-white text-blue-500' : 'bg-white text-gray-800'
                }`}
                title="Bookmark"
              >
                {isBookmarked ? <BookmarkIcon className="w-5 h-5" /> : <BookmarkIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Featured badge */}
          {template.featured && (
            <div className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <SparklesIcon className="w-3 h-3" />
              Featured
            </div>
          )}

          {/* Rating badge */}
          <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <StarIconSolid className="w-3 h-3 text-yellow-400" />
            {template.averageRating.toFixed(1)}
          </div>
        </div>

        {/* Template Content */}
        <div className="p-4">
          {/* Title and Type */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  template.type === 'workshop'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {template.type}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${templateHelpers.getDifficultyColor(template.difficulty)}`}>
                  {template.difficulty}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-1">
                {template.title.pl}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2">
                {template.description?.pl}
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {template.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700"
              >
                #{tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                +{template.tags.length - 3}
              </span>
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {templateHelpers.formatDuration(template.estimatedDuration)}
              </span>
              <span className="flex items-center gap-1">
                <UserGroupIcon className="w-3 h-3" />
                {template.usageCount}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <GlobeAltIcon className="w-3 h-3" />
              <span className="uppercase">{template.language}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className={`border-t border-gray-200 bg-gray-50 px-4 py-2 transition-all duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onDuplicateTemplate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateTemplate(template);
                  }}
                  className="p-1 text-gray-400 hover:text-purple-500"
                  title="Duplicate"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                </button>
              )}
              {onEditTemplate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTemplate(template);
                  }}
                  className="p-1 text-gray-400 hover:text-blue-500"
                  title="Edit"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>Updated {new Date(template.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, [favorites, bookmarks, hoveredTemplate, handleSelectTemplate, handleToggleFavorite, handleToggleBookmark, onDuplicateTemplate, onEditTemplate, onExportTemplate, onShareTemplate]);

  const renderCategoryCard = useCallback((category: TemplateCategory, count: number) => {
    const isSelected = selectedCategory === category;
    const categoryIcons: Record<TemplateCategory, React.ComponentType<any>> = {
      'team-building': UserGroupIcon,
      'conflict-resolution': SparklesIcon,
      'icebreakers': FireIcon,
      'communication': ChatBubbleLeftRightIcon,
      'leadership': AcademicCapIcon,
      'problem-solving': CpuChipIcon,
      'decision-making': AdjustmentsHorizontalIcon,
      'creativity': SparklesIcon,
      'time-management': ClockIcon,
      'stress-management': HeartIcon,
      'diversity-inclusion': GlobeAltIcon,
      'feedback': ChatBubbleLeftRightIcon,
      'goal-setting': TrendingUpIcon,
      'change-management': ArrowPathIcon,
      'trust-building': UserGroupIcon,
      'collaboration': UserGroupIcon,
      'negotiation': ChatBubbleLeftRightIcon,
      'presentation-skills': AcademicCapIcon,
      'emotional-intelligence': HeartIcon,
      'critical-thinking': CpuChipIcon,
      'custom': FolderIcon,
    };

    const Icon = categoryIcons[category] || FolderIcon;

    return (
      <button
        key={category}
        onClick={() => setSelectedCategory(isSelected ? undefined : category)}
        className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-lg'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md bg-white'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className={`p-3 rounded-lg ${
            isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
          }`}>
            <Icon className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold text-gray-900">{count}</span>
        </div>
        <h3 className="font-semibold text-gray-900 capitalize mb-1">
          {category.replace('-', ' ')}
        </h3>
        <p className="text-sm text-gray-600">
          {count} template{count !== 1 ? 's' : ''} available
        </p>
        {isSelected && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
            <CheckIcon className="w-3 h-3" />
          </div>
        )}
      </button>
    );
  }, [selectedCategory]);

  const renderTrendingCard = useCallback((template: Template, index: number) => {
    const trendColors = ['text-yellow-500', 'text-gray-400', 'text-orange-600'];
    const trendIcons = [
      <TrendingUpIcon key="up" className="w-4 h-4" />,
      <SparklesIcon key="stable" className="w-4 h-4" />,
      <FireIcon key="hot" className="w-4 h-4" />,
    ];

    return (
      <div
        key={template.id}
        className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => handleSelectTemplate(template)}
      >
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          index === 0 ? 'bg-yellow-100 text-yellow-600' :
          index === 1 ? 'bg-gray-100 text-gray-600' :
          'bg-orange-100 text-orange-600'
        }`}>
          {index + 1}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">{template.title.pl}</h4>
            <div className={`flex items-center gap-1 text-sm ${trendColors[index % 3]}`}>
              {trendIcons[index % 3]}
              <span className="font-medium">
                {index === 0 ? 'Trending' : index === 1 ? 'Popular' : 'Rising'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <StarIconSolid className="w-3 h-3 text-yellow-400" />
              {template.averageRating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <UserGroupIcon className="w-3 h-3" />
              {template.usageCount} uses
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              template.type === 'workshop'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {template.type}
            </span>
          </div>
        </div>

        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
      </div>
    );
  }, [handleSelectTemplate]);

  // Main render
  return (
    <div className={`template-gallery ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {featuredOnly ? 'Featured Templates' : 'Template Gallery'}
            </h1>
            <p className="text-gray-600">
              Discover and explore professionally designed workshop and questionnaire templates
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SearchSort)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="popularity">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="rating">Highest Rated</option>
              <option value="usage">Most Used</option>
              <option value="name">Name</option>
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                selectedCategory || selectedType || selectedDifficulty
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates by name, category, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          />
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Category</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(categories).map(([category, count]) => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === category}
                      onChange={() => setSelectedCategory(selectedCategory === category ? undefined : category)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {category.replace('-', ' ')} ({count})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Type</label>
              <div className="space-y-2">
                {['workshop', 'questionnaire'].map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="radio"
                      name="type"
                      checked={selectedType === type}
                      onChange={() => setSelectedType(selectedType === type ? undefined : type)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Difficulty</label>
              <div className="space-y-2">
                {['beginner', 'intermediate', 'advanced', 'expert'].map(difficulty => (
                  <label key={difficulty} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="radio"
                      name="difficulty"
                      checked={selectedDifficulty === difficulty}
                      onChange={() => setSelectedDifficulty(selectedDifficulty === difficulty ? undefined : difficulty)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{difficulty}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Clear Filters */}
          {(selectedCategory || selectedType || selectedDifficulty) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedCategory(undefined);
                  setSelectedType(undefined);
                  setSelectedDifficulty(undefined);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Categories Grid */}
      {!selectedCategory && !searchQuery && Object.keys(categories).length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Browse by Category</h2>
            <button
              onClick={() => setSelectedCategory(undefined)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View all categories
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(categories).map(([category, count]) =>
              renderCategoryCard(category as TemplateCategory, count)
            )}
          </div>
        </div>
      )}

      {/* Trending Templates */}
      {!selectedCategory && !searchQuery && trendingTemplates.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Trending This Week</h2>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <TrendingUpIcon className="w-4 h-4" />
              <span>Updated daily</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trendingTemplates.slice(0, 6).map((template, index) =>
              renderTrendingCard(template, index)
            )}
          </div>
        </div>
      )}

      {/* Popular Tags */}
      {!selectedCategory && !searchQuery && popularTags.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <TagIcon className="w-5 h-5 text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900">Popular Tags</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {popularTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
              >
                #{tag}
                <span className="text-xs text-gray-500">({count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Header */}
      {(selectedCategory || searchQuery || selectedType || selectedDifficulty) && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} found
              </h2>
              {(selectedCategory || searchQuery || selectedType || selectedDifficulty) && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCategory && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                      Category: {selectedCategory}
                      <button
                        onClick={() => setSelectedCategory(undefined)}
                        className="hover:text-blue-900"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedType && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                      Type: {selectedType}
                      <button
                        onClick={() => setSelectedType(undefined)}
                        className="hover:text-blue-900"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {selectedDifficulty && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs mr-2">
                      Difficulty: {selectedDifficulty}
                      <button
                        onClick={() => setSelectedDifficulty(undefined)}
                        className="hover:text-blue-900"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      Search: "{searchQuery}"
                      <button
                        onClick={() => setSearchQuery('')}
                        className="hover:text-blue-900"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading templates...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3">
            <InformationCircleIcon className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-red-900 font-medium">Error loading templates</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      {!loading && !error && filteredTemplates.length > 0 && (
        <div className={`grid gap-6 ${
          viewMode === 'grid'
            ? `grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {filteredTemplates.map(renderTemplateCard)}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || selectedCategory || selectedType || selectedDifficulty
              ? 'Try adjusting your search or filters'
              : 'Check back later for new templates'
            }
          </p>
          {(searchQuery || selectedCategory || selectedType || selectedDifficulty) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(undefined);
                setSelectedType(undefined);
                setSelectedDifficulty(undefined);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Clear Search & Filters
            </button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedTemplate && (
        <TemplatePreviewModal
          template={selectedTemplate}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedTemplate(null);
          }}
          onSelect={() => {
            setShowPreviewModal(false);
            if (onSelectTemplate) {
              onSelectTemplate(selectedTemplate);
            }
          }}
        />
      )}
    </div>
  );
};

// Preview Modal Component
const TemplatePreviewModal: React.FC<{
  template: Template;
  onClose: () => void;
  onSelect: () => void;
}> = ({ template, onClose, onSelect }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Template Preview</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto max-h-[calc(90vh-8rem)]">
          {/* Template preview content would go here */}
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <AcademicCapIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {template.title.pl}
            </h3>
            <p className="text-gray-600">
              Full preview functionality would be implemented here
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={onSelect}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Use This Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateGallery;