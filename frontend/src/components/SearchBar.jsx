function SearchBar({ value, onChange, placeholder = "Search..." }) {
  return (
    <input
      type="text"
      className="search-bar"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

export default SearchBar;
