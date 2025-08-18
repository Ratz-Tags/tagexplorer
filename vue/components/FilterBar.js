export default {
  name: 'FilterBar',
  template: `
    <nav class="filter-bar collapsed" role="navigation" aria-label="Tag filters">
      <div id="tag-filter">
        <div class="filter-inputs">
          <label for="tag-search" class="visually-hidden">Filter tags</label>
          <input
            type="text"
            id="tag-search"
            placeholder="Type to filter tags..."
            aria-describedby="tag-search-help"
          />

          <label for="artist-name-filter" class="visually-hidden">Filter by artist name</label>
          <input
            type="text"
            id="artist-name-filter"
            placeholder="Filter by artist name..."
            aria-describedby="artist-filter-help"
          >
        </div>

        <div id="tag-buttons" role="group" aria-label="Available tags"></div>

        <button
          id="clear-tags"
          style="display:none;"
          aria-label="Clear all selected tags"
        >
          Clear All
        </button>

        <!-- Screen reader helpers -->
        <div id="tag-search-help" class="visually-hidden">
          Type to search and filter available tags
        </div>
        <div id="artist-filter-help" class="visually-hidden">
          Type to filter artists by name
        </div>
      </div>
    </nav>
  `
};
